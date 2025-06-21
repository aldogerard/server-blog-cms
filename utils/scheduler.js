import moment from "moment-timezone";
import db from "../config/db.js";
import cron from "node-cron";

const checkSchedule = async () => {
    const now = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");
    console.log(`🕒 Checking at ${now}`);

    try {
        const { data: schedules, error } = await db
            .from("article_schedule")
            .select("id, article_id, scheduled_at, is_published, is_expired")
            .lte("scheduled_at", now)
            .eq("is_published", false)
            .eq("is_expired", false);

        if (error) throw error;

        if (schedules && schedules.length > 0) {
            for (const sched of schedules) {
                await db
                    .from("article_schedule")
                    .update({ is_published: true, published_at: now })
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

        if (expiredError) throw expiredError;

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

let hours = 0;
let minutes = 0;

cron.schedule(`${minutes} ${hours} * * *`, checkSchedule, {
    timezone: "Asia/Jakarta",
});

hours = hours.toString().padStart(2, "0");
minutes = minutes.toString().padStart(2, "0");

console.log(
    `🔄 Scheduler initialized. Will run daily at ${hours}:${minutes} WIB.`
);
