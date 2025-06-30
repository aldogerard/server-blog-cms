import multer from "multer";

const storage = multer.memoryStorage();
export const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // maksimal ukuran file: 5MB
        fieldSize: 10 * 1024 * 1024, // maksimal ukuran field teks: 10MB (untuk HTML editor)
        fields: 20, // maksimal jumlah total field
        files: 1, // maksimal jumlah file
    },
});
