const express = require('express');
const app = express();
const path = require('path');
const session = require("express-session");
const mongoose = require('mongoose'); 
const router = require('./routes/myrouter');

// ==========================================
//  ส่วนการเชื่อมต่อ Database 
// ==========================================
mongoose.connect('mongodb://127.0.0.1:27017/ITMISHOP')
    .then(() => console.log("✅เชื่อมต่อ MongoDB สำเร็จแล้ว"))
    .catch((err) => console.error("❌ เชื่อมต่อ MongoDB ไม่สำเร็จ:", err));


// ==========================================
//  การตั้งค่า Express และ View Engine
// ==========================================
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// ตั้งค่าให้รับข้อมูลจากฟอร์มได้ (POST Method)
app.use(express.urlencoded({ extended: false }));

// ตั้งค่าโฟลเดอร์สำหรับไฟล์ Static (CSS, Images)
app.use(express.static(path.join(__dirname, 'public')));


// ==========================================
//  ระบบ Session (คุกกี้)
// ==========================================
app.use(session({
    secret: "mysecretKey",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 } // ให้ Session อยู่ได้ 1 ชั่วโมง
}));


// ==========================================
//  Middleware ส่งตัวแปรไปทุกหน้า (res.locals)
// ==========================================
app.use((req, res, next) => {
    res.locals.login = req.session.login || false;
    res.locals.user = req.session.user || null;
    res.locals.session = req.session; 
    next();
});


// ==========================================
//  เรียกใช้งาน Router และเริ่ม Server
// ==========================================
app.use(router);

app.listen(8080, () => {
    console.log("🚀 Server is running at http://localhost:8080");
});