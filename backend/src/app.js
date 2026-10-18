import express from "express";
const app = express();
app.use(express.json());
app.get("/", (req, res) => {
    res.json({
        message: "Fashion API is running",
    });
});
export default app;
//# sourceMappingURL=app.js.map