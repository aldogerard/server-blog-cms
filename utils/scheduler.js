import moment from "moment-timezone";
import db from "../config/db.js";

const checkSchedule = async () => {
    const now = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");
    console.log(`🕒 Checking at ${now}`);

    try {
        const { data: schedules, error } = await db
            .from("article_schedule")
            .select("id, article_id, scheduled_at, is_published")
            .lte("scheduled_at", now)
            .eq("is_published", false);

        if (error) throw error;

        if (schedules && schedules.length > 0) {
            for (const sched of schedules) {
                await db
                    .from("article_schedule")
                    .update({ is_published: true })
                    .eq("id", sched.id);

                console.log(
                    `✅ Published article ID ${sched.article_id} at ${now}`
                );
            }
        }

        const { data: expiredArticles, error: expiredError } = await db
            .from("article_schedule")
            .select("id, article_id, expired_at, is_expired")
            .lte("expired_at", now)
            .eq("is_expired", false);

        if (expiredError) throw error;

        if (expiredArticles && expiredArticles.length > 0) {
            for (const sched of expiredArticles) {
                await db
                    .from("article_schedule")
                    .update({ is_expired: true, is_published: false })
                    .eq("id", sched.id);

                console.log(
                    `❌ Expired article ID ${sched.article_id} at ${now}`
                );
            }
        }
    } catch (err) {
        console.error("🔥 Scheduler error:", err.message);
    }
};

setInterval(checkSchedule, 10000);
