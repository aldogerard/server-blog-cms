import db from "../config/db.js";
import { failedReq, successReq } from "../utils/response.js";
import moment from "moment-timezone";

import dotenv from "dotenv";
dotenv.config();

const findById = async (id) => {
    try {
        const { data: result } = await db
            .from("articles")
            .select("*")
            .eq("id", id);

        if (!result) {
            return false;
        }

        return result;
    } catch (error) {
        return false;
    }
};

const findArticleImage = async (id) => {
    try {
        const { data: result } = await db
            .from("article_images")
            .select("image_url")
            .eq("article_id", id);
        if (result.length === 0) {
            return false;
        }
        return result[0].image_url;
    } catch (error) {
        return false;
    }
};

const findArticleScheduled = async (id) => {
    try {
        const { data: result } = await db
            .from("article_schedule")
            .select("is_published, scheduled_at")
            .eq("article_id", id);
        if (result.length === 0) {
            return false;
        }
        const { is_published, scheduled_at } = result[0];
        return { isPublished: is_published, scheduledAt: scheduled_at };
    } catch (error) {
        return false;
    }
};

const mappingArticle = async (article) => {
    const datas = await Promise.all(
        article.map(async (res) => {
            const imageUrl = await findArticleImage(res.id);
            const { scheduledAt, isPublished } = await findArticleScheduled(
                res.id
            );
            return {
                id: res.id,
                title: res.title,
                content: res.content,
                slug: res.slug,
                user_id: res.user_id,
                created_at: res.created_at,
                updated_at: res.updated_at,
                imageUrl,
                isPublished,
                scheduledAt,
            };
        })
    );

    return datas.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
};

const uploadImage = async (file, filename) => {
    try {
        const { data, error } = await db.storage
            .from("blog-cms")
            .upload(filename, file.buffer, {
                contentType: file.mimetype,
                upsert: true,
            });
        if (error) throw new Error(error.message);
        const { data: publicUrl } = db.storage
            .from("blog-cms")
            .getPublicUrl(data.path);
        return publicUrl.publicUrl;
    } catch (error) {}
};

const saveArticleImage = async (articleId, imageUrl, filename) => {
    try {
        const { error } = await db
            .from("article_images")
            .insert([
                {
                    article_id: articleId,
                    image_url: imageUrl,
                    filename,
                    created_at: moment()
                        .tz("Asia/Jakarta")
                        .format("YYYY-MM-DD HH:mm:ss"),
                },
            ])
            .select();

        if (error) throw new Error(error.message);
    } catch (error) {}
};

const saveScheduledArticleImage = async (articleId, scheduledAt) => {
    const publishNow = new Date(scheduledAt) < new Date();

    try {
        const { error } = await db
            .from("article_schedule")
            .insert([
                {
                    article_id: articleId,
                    scheduled_at: scheduledAt,
                    is_published: publishNow ? true : false,
                },
            ])
            .select();

        if (error) throw new Error(error.message);
    } catch (error) {}
};

const slugify = (text) => {
    return (
        text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/[\s\W-]+/g, "-")
            .replace(/^-+|-+$/g, "") +
        "-" +
        Date.now()
    );
};

// export const getAllArticles = async (req, res) => {
//     try {
//         const page = req.query.page || 1;
//         const size = req.query.size || 10;
//         const published = req.query.published || "true";
//         const isPublished = published === "true";

//         const offset = (page - 1) * size;
//         const offsetSize = offset + parseInt(size);

//         const { data: result } = await db
//             .from("articles")
//             .select("*, article_schedule(is_published, scheduled_at)");

//         if (result === null) {
//             successReq(res, 200, "Articles is empty");
//             return;
//         }

//         const isAdmin = req.user?.role === "admin";

//         let filtered = result;
//         if (isAdmin) {
//             if (req.query.published !== undefined) {
//                 filtered = result.filter(
//                     (article) =>
//                         article.article_schedule[0].is_published === isPublished
//                 );
//             }
//         } else {
//             filtered = result.filter(
//                 (article) => article.article_schedule[0].is_published === true
//             );
//         }

//         const datas = await mappingArticle(filtered);

//         const paginatedData = datas.slice(offset, offsetSize);

//         successReq(res, 200, "Articles found", paginatedData);
//     } catch (error) {
//         failedReq(res, 500, error.message);
//     }
// };

export const getArticleById = async (req, res) => {
    try {
        const id = req.params.id;

        const result = await findById(id);
        if (!result) {
            successReq(res, 404, "Article not found", null);
            return;
        }

        const data = await mappingArticle(result);

        successReq(res, 200, "Article found", data[0]);
    } catch (error) {
        failedReq(res, 500, error.message);
    }
};

export const getArticleBySlug = async (req, res) => {
    try {
        const slug = req.params.slug;

        const { data: result } = await db
            .from("articles")
            .select("*")
            .eq("slug", slug);

        if (result.length === 0) {
            return failedReq(res, 404, "Article not found");
        }

        const data = await mappingArticle(result);

        successReq(res, 200, "Article found", data[0]);
    } catch (error) {
        failedReq(res, 500, error.message);
    }
};

export const getArticleByTitle = async (req, res) => {
    try {
        const title = req.params.title;

        const page = req.query.page || 1;
        const size = req.query.size || 10;
        const published = req.query.published || "true";
        const isPublished = published === "true";

        const offset = (page - 1) * size;
        const offsetSize = offset + parseInt(size) - 1;

        const { data: result } = await db
            .from("articles")
            .select("*, article_schedule(is_published, scheduled_at)")
            .ilike("title", `%${title}%`);

        if (result.length === 0) {
            return failedReq(res, 404, "Article not found");
        }

        const isAdmin = req.user?.role === "admin";

        let filtered = result;
        if (isAdmin) {
            if (req.query.published !== undefined) {
                filtered = result.filter(
                    (article) =>
                        article.article_schedule[0].is_published === isPublished
                );
            }
        } else {
            filtered = result.filter(
                (article) => article.article_schedule[0].is_published === true
            );
        }

        const datas = await mappingArticle(filtered);

        const paginatedData = datas.slice(offset, offsetSize);

        successReq(res, 200, "Article found", paginatedData);
    } catch (error) {
        failedReq(res, 500, error.message);
    }
};

export const createArticle = async (req, res) => {
    try {
        const { title, content, scheduledAt } = req.body;
        const file = req.file;

        const scheduledAtWIB = moment(scheduledAt)
            .tz("Asia/Jakarta")
            .format("YYYY-MM-DD HH:mm:ss");

        console.log(scheduledAtWIB);

        const { data: result } = await db
            .from("articles")
            .select("*")
            .eq("title", title)
            .single();

        if (result) {
            return failedReq(res, 400, "Article already exists");
        }

        if (!file)
            return res.status(400).json({ message: "Image is required" });

        const filename = `article-${Date.now()}-${file.originalname}`;
        const imageUrl = await uploadImage(file, filename);

        const { data: article, error } = await db
            .from("articles")
            .insert([
                {
                    title,
                    content,
                    slug: slugify(title),
                    user_id: req.user.id,
                    created_at: moment()
                        .tz("Asia/Jakarta")
                        .format("YYYY-MM-DD HH:mm:ss"),
                },
            ])
            .select();
        if (error) throw new Error(error.message);

        await saveScheduledArticleImage(article[0].id, scheduledAtWIB);

        await saveArticleImage(article[0].id, imageUrl, filename);

        successReq(res, 200, "Article created", article[0]);
    } catch (error) {
        failedReq(res, 500, error.message);
    }
};

export const deleteArticleById = async (req, res) => {
    try {
        const id = req.params.id;

        const result = await findById(id);
        if (!result) {
            successReq(res, 404, "Article not found", null);
            return;
        }

        const {
            data: { filename },
        } = await db
            .from("article_images")
            .select("filename")
            .eq("article_id", id)
            .single();

        const { error: deleteStorageError } = await db.storage
            .from("blog-cms")
            .remove(filename);

        if (deleteStorageError) throw new Error(deleteStorageError.message);

        const { error: deleteImageError } = await db
            .from("article_images")
            .delete()
            .eq("article_id", id)
            .select();

        if (deleteImageError) throw new Error(deleteImageError.message);

        const { error: deleteScheduledError } = await db
            .from("article_schedule")
            .delete()
            .eq("article_id", id)
            .select();
        if (deleteScheduledError) throw new Error(deleteScheduledError.message);

        const { error: deleteError } = await db
            .from("articles")
            .delete()
            .eq("id", id)
            .select();

        if (deleteError) throw new Error(deleteError.message);

        successReq(res, 200, "Article deleted", null);
    } catch (error) {
        failedReq(res, 500, error.message);
    }
};

export const updateArticleById = async (req, res) => {
    try {
        const id = req.params.id;
        const { title, content } = req.body;
        const file = req.file;

        const result = await findById(id);
        if (!result) {
            successReq(res, 404, "Article not found", null);
            return;
        }
        if (title || content) {
            const { error: updateError } = await db
                .from("articles")
                .update({
                    title,
                    content,
                    slug: slugify(title),
                    updated_at: moment()
                        .tz("Asia/Jakarta")
                        .format("YYYY-MM-DD HH:mm:ss"),
                })
                .eq("id", id)
                .select();

            if (updateError) throw new Error(updateError.message);
        }

        // === Gambar ===
        if (file) {
            const {
                data: { filename },
            } = await db
                .from("article_images")
                .select("filename")
                .eq("article_id", id)
                .single();

            const { error: deleteStorageError } = await db.storage
                .from("blog-cms")
                .remove(filename);
            if (deleteStorageError) throw new Error(deleteStorageError.message);

            const { error: deleteImageError } = await db
                .from("article_images")
                .delete()
                .eq("article_id", id)
                .select();
            if (deleteImageError) throw new Error(deleteImageError.message);

            const path = `articles-${Date.now()}-${file.originalname}`;
            const imageUrl = await uploadImage(file, path);

            await saveArticleImage(id, imageUrl, path);
        }

        successReq(res, 200, "Article updated", null);
    } catch (error) {
        failedReq(res, 500, error.message);
    }
};

export const getAllArticles = async (req, res) => {
    try {
        const page = req.query.page || 1;
        const size = req.query.size || 5;
        const title = req.query.title || "";

        const published = req.query.published || "true";
        const isPublished = published === "true";

        const offset = (page - 1) * size;
        const offsetSize = offset + parseInt(size);

        let query = db
            .from("articles")
            .select("*, article_schedule(is_published, scheduled_at)");

        if (title) {
            query = query.ilike("title", `%${title}%`);
        }

        const { data: result } = await query;

        if (result === null) {
            successReq(res, 200, "Articles not found", null);
            return;
        }

        const isAdmin = req.user?.role === "admin";

        let filtered = result;
        if (isAdmin) {
            if (req.query.published !== undefined) {
                filtered = result.filter(
                    (article) =>
                        article.article_schedule[0].is_published === isPublished
                );
            }
        } else {
            filtered = result.filter(
                (article) => article.article_schedule[0].is_published === true
            );
        }

        const datas = await mappingArticle(filtered);

        const paginatedData = datas.slice(offset, offsetSize);

        successReq(res, 200, "Article found", paginatedData);
    } catch (error) {
        failedReq(res, 500, error.message);
    }
};
