import express from "express";
import {
    createArticle,
    deleteArticleById,
    getAllArticles,
    getArticleById,
    getArticleBySlug,
    getArticleByTitle,
    updateArticleById,
    publishArticleById,
    unPublishArticleById,
    rePublishArticleById,
} from "../controllers/articlesController.js";
import { isAdmin } from "../middleware/isAdmin.js";
import { upload } from "../middleware/uploadMiddleware.js";
import { defineUser } from "../middleware/defineUser.js";

const router = express.Router();
const BASE_URL = "/api/articles";

router.get(`${BASE_URL}`, defineUser, getAllArticles);
router.get(`${BASE_URL}/:id`, getArticleById);
router.get(`${BASE_URL}/slug/:slug`, getArticleBySlug);
router.get(`${BASE_URL}/title/:title`, defineUser, getArticleByTitle);
router.post(`${BASE_URL}`, isAdmin, upload.single("image"), createArticle);
router.patch(
    `${BASE_URL}/:id`,
    isAdmin,
    upload.single("image"),
    updateArticleById
);
router.delete(`${BASE_URL}/:id`, isAdmin, deleteArticleById);
router.patch(
    `${BASE_URL}/publish/:id`,
    isAdmin,
    upload.single("image"),
    publishArticleById
);
router.patch(`${BASE_URL}/unpublish/:id`, isAdmin, unPublishArticleById);
router.patch(
    `${BASE_URL}/republish/:id`,
    isAdmin,
    upload.single("image"),
    rePublishArticleById
);

export default router;
