import db from "../config/db.js";
import { failedReq, successReq } from "../utils/response.js";
import moment from "moment-timezone";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import e from "cors";
import { schedule } from "node-cron";
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
            .select(
                "is_published, scheduled_at, expired_at, is_expired, published_at"
            )
            .eq("article_id", id);
        if (result.length === 0) {
            return false;
        }
        const {
            is_published,
            scheduled_at,
            expired_at,
            is_expired,
            published_at,
        } = result[0];
        return {
            isPublished: is_published,
            scheduledAt: scheduled_at,
            expiredAt: expired_at,
            isExpired: is_expired,
            publishedAt: published_at,
        };
    } catch (error) {
        return false;
    }
};

const mappingArticle = async (article) => {
    const datas = await Promise.all(
        article.map(async (res) => {
            const imageUrl = await findArticleImage(res.id);
            const {
                scheduledAt,
                isPublished,
                expiredAt,
                isExpired,
                publishedAt,
            } = await findArticleScheduled(res.id);

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
                expiredAt,
                isExpired,
                publishedAt,
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

const saveScheduledArticle = async (articleId, scheduledAt, expiredAt) => {
    const publishNow = new Date(scheduledAt) <= new Date();
    try {
        const { error } = await db
            .from("article_schedule")
            .insert([
                {
                    article_id: articleId,
                    scheduled_at: scheduledAt,
                    expired_at: expiredAt,
                    published_at: publishNow
                        ? moment().tz("Asia/Jakarta").format("YYYY-MM-DD")
                        : null,
                    is_published: publishNow ? true : false,
                },
            ])
            .select();

        if (error) throw new Error(error.message);
    } catch (error) {
        console.log(error);
    }
};

const processBase64Images = async (html) => {
    const regex = /<img[^>]+src=["'](data:image\/[^"']+)["'][^>]*>/g;
    let match;
    const uploads = [];

    while ((match = regex.exec(html))) {
        const base64Str = match[1];
        const extension = base64Str.match(/data:image\/(.*?);base64/)[1];
        const base64Data = base64Str.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const filename = `content-${uuidv4()}.${extension}`;

        const { data, error } = await db.storage
            .from("blog-cms")
            .upload(filename, buffer, {
                contentType: `image/${extension}`,
            });

        if (error) throw new Error("Failed to upload content image");

        const publicURL = db.storage.from("blog-cms").getPublicUrl(filename)
            .data.publicUrl;

        uploads.push({ original: base64Str, url: publicURL });
    }

    uploads.forEach((img) => {
        html = html.replace(img.original, img.url);
    });

    return html;
};

const extractFilenameFromUrl = (url) => {
    const parts = url.split("/");
    return parts[parts.length - 1];
};

const extractImageFilenamesFromContent = (content) => {
    const regex = /<img[^>]+src="([^">]+)"/g;
    const matches = [];
    let match;
    while ((match = regex.exec(content))) {
        const src = match[1];
        if (src.includes("supabase.co/storage")) {
            matches.push(extractFilenameFromUrl(src));
        }
    }
    return matches;
};

const extractImageUrls = (html) => {
    const regex = /<img[^>]+src=["']([^"']+)["']/g;
    const urls = [];
    let match;
    while ((match = regex.exec(html))) {
        urls.push(match[1]);
    }
    return urls;
};

const extractBase64Images = (html) => {
    const regex =
        /<img[^>]+src=["'](data:image\/(png|jpeg|jpg|gif);base64,[^"']+)["']/g;
    const base64s = [];
    let match;
    while ((match = regex.exec(html))) {
        base64s.push(match[1]);
    }
    return base64s;
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

export const getDataArticles = async (req, res) => {
    try {
        const { data } = await db
            .from("articles")
            .select("id, article_schedule(is_published, is_expired)");

        let stats = {
            total: 0,
            published: 0,
            notPublished: 0,
            expired: 0,
            notExpired: 0,
        };

        data?.forEach((item) => {
            stats.total++;
            const schedule = item.article_schedule[0];
            if (schedule?.is_published === true) stats.published++;
            else stats.notPublished++;

            if (schedule?.is_expired === true) stats.expired++;
            else stats.notExpired++;
        });

        successReq(res, 200, "Articles found", stats);
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

        const expired = req.query.expired || "false";
        const isExpired = expired === "true";

        const offset = (page - 1) * size;
        const offsetSize = offset + parseInt(size);

        let query = db
            .from("articles")
            .select(
                "*, article_schedule(is_published, scheduled_at, expired_at, is_expired)"
            );

        if (title) {
            query = query.ilike("title", `%${title}%`);
        }

        const { data: result } = await query;

        if (result === null) {
            failedReq(res, 404, "Articles not found", null);
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
            if (req.query.expired !== undefined) {
                filtered = filtered.filter(
                    (article) =>
                        article.article_schedule[0].is_expired === isExpired
                );
            }
        } else {
            filtered = result
                .filter(
                    (article) =>
                        article.article_schedule[0].is_published === true
                )
                .filter(
                    (article) =>
                        article.article_schedule[0].is_expired === false
                );
        }

        if (filtered.length === 0) {
            failedReq(res, 404, "Articles not found", null);
            return;
        }

        const datas = await mappingArticle(filtered);

        let sortData;

        if (!isAdmin) {
            sortData = datas.sort((a, b) => {
                const dateA = new Date(a.publishedAt);
                const dateB = new Date(b.publishedAt);

                if (dateB - dateA !== 0) {
                    return dateB - dateA;
                }

                return a.title.localeCompare(b.title);
            });
        } else {
            sortData = datas;
        }

        const paginatedData = sortData.slice(offset, offsetSize);

        const paging = {
            page,
            size,
            totalElements: datas.length,
            totalPages: Math.ceil(datas.length / size),
        };
        successReq(res, 200, "Article found", { data: paginatedData, paging });
    } catch (error) {
        failedReq(res, 500, error.message);
    }
};

export const getArticleById = async (req, res) => {
    try {
        const id = req.params.id;

        const result = await findById(id);
        if (!result) {
            failedReq(res, 404, "Article not found", null);
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
        const { title, content: rawContent, scheduledAt, expiredAt } = req.body;
        const file = req.file;

        const { data: result } = await db
            .from("articles")
            .select("*")
            .eq("title", title)
            .single();

        if (result) {
            return failedReq(res, 400, "Article already exists");
        }

        if (!file) return failedReq(res, 400, "Thumbnail image is required");

        const filename = `article-${Date.now()}-${file.originalname}`;
        const imageUrl = await uploadImage(file, filename);

        const content = await processBase64Images(rawContent);

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

        await saveScheduledArticle(article[0].id, scheduledAt, expiredAt);
        await saveArticleImage(article[0].id, imageUrl, filename);

        successReq(res, 200, "Article created", article[0]);
    } catch (error) {
        failedReq(res, 500, error.message);
    }
};

export const deleteArticleById = async (req, res) => {
    try {
        const id = req.params.id;

        const article = await findById(id);
        if (!article) {
            return failedReq(res, 404, "Article not found");
        }

        const { data: imageData, error: imageError } = await db
            .from("article_images")
            .select("filename")
            .eq("article_id", id)
            .single();
        if (imageError) throw new Error(imageError.message);

        const filenamesFromContent = extractImageFilenamesFromContent(
            article[0].content
        );

        const allFilenames = [imageData.filename, ...filenamesFromContent];

        const { error: deleteStorageError } = await db.storage
            .from("blog-cms")
            .remove(allFilenames);
        if (deleteStorageError) throw new Error(deleteStorageError.message);

        const { error: deleteImageError } = await db
            .from("article_images")
            .delete()
            .eq("article_id", id);
        if (deleteImageError) throw new Error(deleteImageError.message);

        const { error: deleteScheduleError } = await db
            .from("article_schedule")
            .delete()
            .eq("article_id", id);
        if (deleteScheduleError) throw new Error(deleteScheduleError.message);

        const { error: deleteArticleError } = await db
            .from("articles")
            .delete()
            .eq("id", id);
        if (deleteArticleError) throw new Error(deleteArticleError.message);

        return successReq(res, 200, "Article and related data deleted", null);
    } catch (error) {
        return failedReq(res, 500, error.message);
    }
};

export const updateArticleById = async (req, res) => {
    try {
        const id = req.params.id;
        let { title, content, expiredAt, scheduledAt } = req.body;
        const file = req.file;

        const result = await findById(id);
        if (!result) return failedReq(res, 404, "Article not found");

        const oldContent = result[0].content;

        // === Upload gambar base64 baru ke Supabase dan ganti di konten ===
        const base64Images = extractBase64Images(content);
        for (let i = 0; i < base64Images.length; i++) {
            const base64 = base64Images[i];
            const buffer = Buffer.from(base64.split(",")[1], "base64");
            const typeMatch = base64.match(/^data:image\/(\w+);base64,/);
            const ext = typeMatch ? typeMatch[1] : "png";
            const filename = `content-${Date.now()}-${i}.${ext}`;
            const url = await uploadImage(
                { buffer, mimetype: `image/${ext}` },
                filename
            );
            content = content.replace(base64, url);
        }

        if (title || content || expiredAt || scheduledAt) {
            const { error: updateError } = await db
                .from("articles")
                .update({
                    title,
                    content,
                    slug:
                        result[0].title === title
                            ? result[0].slug
                            : slugify(title),
                    updated_at: moment()
                        .tz("Asia/Jakarta")
                        .format("YYYY-MM-DD HH:mm:ss"),
                })
                .eq("id", id)
                .select();

            if (updateError) throw new Error(updateError.message);

            const publishNow = new Date(scheduledAt) <= new Date();

            const { error: updateScheduledError } = await db
                .from("article_schedule")
                .update({
                    expired_at: expiredAt,
                    scheduled_at: scheduledAt,
                    is_published: publishNow,
                    published_at: publishNow
                        ? moment().tz("Asia/Jakarta").format("YYYY-MM-DD")
                        : null,
                })
                .eq("article_id", id)
                .select();

            if (updateScheduledError)
                throw new Error(updateScheduledError.message);

            // === CLEAN UP UNUSED CONTENT IMAGES ===
            const supabaseUrl = process.env.SUPABASE_URL;
            const oldImages = extractImageUrls(oldContent).filter((url) =>
                url.includes(
                    `${supabaseUrl}/storage/v1/object/public/blog-cms/`
                )
            );
            const newImages = extractImageUrls(content).filter((url) =>
                url.includes(
                    `${supabaseUrl}/storage/v1/object/public/blog-cms/`
                )
            );

            const unusedImages = oldImages.filter(
                (url) => !newImages.includes(url)
            );

            for (const url of unusedImages) {
                const filename = url.split("/").slice(-1)[0];
                await db.storage.from("blog-cms").remove([filename]);
            }
        }

        // === Gambar cover utama ===
        if (file) {
            const {
                data: { filename },
            } = await db
                .from("article_images")
                .select("filename")
                .eq("article_id", id)
                .single();

            await db.storage.from("blog-cms").remove([filename]);

            await db.from("article_images").delete().eq("article_id", id);

            const path = `articles-${Date.now()}-${file.originalname}`;
            const imageUrl = await uploadImage(file, path);

            await saveArticleImage(id, imageUrl, path);
        }

        successReq(res, 200, "Article updated", null);
    } catch (error) {
        failedReq(res, 500, error.message);
    }
};

export const publishArticleById = async (req, res) => {
    try {
        const id = req.params.id;

        const result = await findById(id);

        if (!result) {
            failedReq(res, 404, "Article not found", null);
            return;
        }

        const { error: updateError } = await db
            .from("article_schedule")
            .update({
                is_published: true,
                published_at: moment().tz("Asia/Jakarta").format("YYYY-MM-DD"),
            })
            .eq("article_id", id)
            .select();

        if (updateError) throw new Error(updateError.message);

        successReq(res, 200, "Article published", null);
    } catch (error) {
        failedReq(res, 500, error.message);
    }
};

export const unPublishArticleById = async (req, res) => {
    try {
        const id = req.params.id;

        const { error: updateError } = await db
            .from("article_schedule")
            .update({
                is_published: false,
                is_expired: true,
                expired_at: moment().tz("Asia/Jakarta").format("YYYY-MM-DD"),
            })
            .eq("article_id", id)
            .select();

        if (updateError) throw new Error(updateError.message);

        successReq(res, 200, "Article unpublished", null);
    } catch (error) {
        failedReq(res, 500, error.message);
    }
};

export const rePublishArticleById = async (req, res) => {
    try {
        const id = req.params.id;
        const expiredAt = req.body.expiredAt;

        const { error: updateError } = await db
            .from("article_schedule")
            .update({
                scheduled_at: moment().tz("Asia/Jakarta").format("YYYY-MM-DD"),
                expired_at: expiredAt,
                is_expired: false,
                is_published: true,
                published_at: moment().tz("Asia/Jakarta").format("YYYY-MM-DD"),
            })
            .eq("article_id", id)
            .select();

        if (updateError) throw new Error(updateError.message);

        successReq(res, 200, "Article re-published", null);
    } catch (error) {
        failedReq(res, 500, error.message);
    }
};
