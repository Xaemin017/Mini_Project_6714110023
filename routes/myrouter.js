const express = require('express');
const router = express.Router();
const Product = require('../models/products');
const Member = require('../models/members');
const Sale = require('../models/sales');
const bcrypt = require("bcryptjs");
const multer = require('multer');

// ==========================================
//  ส่วนที่ 1: การตั้งค่าต่างๆ (Config & Upload)
// ==========================================

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, './public/images/products');
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + ".jpg");
    }
});
const upload = multer({ storage: storage });

// ==========================================
//  ส่วนที่ 2: ฟังก์ชันเช็คสิทธิ์ (Middlewares)
// ==========================================

function isOwner(req, res, next) {
    if (req.session.login && req.session.user.role === 'owner') {
        return next();
    }
    res.status(403).send("เข้าถึงไม่ได้: หน้านี้สำหรับเจ้าของร้านเท่านั้น");
}

function isStaff(req, res, next) {
    if (req.session.login && (req.session.user.role === 'staff' || req.session.user.role === 'owner')) {
        return next();
    }
    res.redirect("/login");
}

// ==========================================
//  ส่วนที่ 3: หน้าเว็บสำหรับลูกค้า (Public Routes)
// ==========================================

// หน้าแรก - แสดงสินค้าทั้งหมด
router.get('/', async (req, res) => {
    try {
        const products = await Product.find().exec();
        const allBrands = await Product.distinct("brand"); 
        res.render('index', { 
            products: products, 
            brands: allBrands, 
            title: "สินค้าทั้งหมด",
            login: req.session.login,
            user: req.session.user
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// กรองตามยี่ห้อ
router.get('/brand/:name', async (req, res) => {
    try {
        const brandName = req.params.name;
        const products = await Product.find({ 
            brand: { $regex: new RegExp(brandName, "i") } 
        });
        const allBrands = await Product.distinct("brand"); 
        res.render('index', { 
            products: products, 
            brands: allBrands,
            title: 'ยี่ห้อ: ' + brandName,
            login: req.session.login,
            user: req.session.user
        });
    } catch (err) {
        res.redirect('/');
    }
});

// ค้นหาตามช่วงราคา
router.get('/search', async (req, res) => {
    try {
        const minPrice = Number(req.query.min) || 0;
        const maxPrice = Number(req.query.max) || 9999999;
        const products = await Product.find({
            price: { $gte: minPrice, $lte: maxPrice }
        }).sort({ price: 1 });
        const allBrands = await Product.distinct("brand"); 
        res.render('index', { 
            products: products, 
            brands: allBrands, 
            title: `ช่วงราคา: ฿${minPrice} - ฿${maxPrice}`,
            login: req.session.login,
            user: req.session.user
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});
// ค้นหาเว็ปหลัก
router.get('/search-product', async (req, res) => {
    try {
        const query = req.query.q;
        // ค้นหาชื่อสินค้าที่ "มีคำนั้นอยู่" (Case-insensitive)
        const products = await Product.find({ 
            name: { $regex: new RegExp(query, "i") } 
        });
        const allBrands = await Product.distinct("brand");
        
        res.render('index', { 
            products: products, 
            brands: allBrands, 
            title: `ผลการค้นหา: "${query}"`,
            login: req.session.login,
            user: req.session.user
        });
    } catch (err) { res.redirect('/'); }
});

// หน้าอื่นๆ
router.get('/promotions', async (req, res) => {
    try {
        const { min, max, brand } = req.query;
        let query = { $expr: { $gt: ["$oldPrice", "$price"] } };
        if (min || max) {
            query.price = { $gte: Number(min) || 0, $lte: Number(max) || 999999 };
        }
        if (brand) { query.brand = brand; }
        const products = await Product.find(query).exec();
        const allBrands = await Product.distinct("brand");
        res.render('promotions', { 
            products: products, brands: allBrands, title: "🔥 HOT PROMOTIONS",
            login: req.session.login, user: req.session.user
        });
    } catch (err) { res.status(500).send(err.message); }
});

// ==========================================
//  ส่วนที่ 3.1: ระบบเพิ่มเติม (Filler)
// ==========================================

//ส่วน Dragdown Aboutus ETech
router.get('/about', (req, res) => { res.render('about', { title: 'เกี่ยวกับเรา - ETech' }); });
router.get('/join-us', (req, res) => { res.render('joinus', { title: "ร่วมงานกับเรา", login: req.session.login, user: req.session.user }); });
//  หน้าตรวจสอบสินค้า
router.get('/verification', (req, res) => {
    res.render('verification', { title: "ตรวจสอบความถูกต้องสินค้า" });
});

//  หน้านโยบาย
router.get('/policy', (req, res) => {
    res.render('policy', { title: "นโยบายของ ETech" });
});




// ==========================================
//  ส่วนที่ 4: ระบบตะกร้าและชำระเงิน (Cart & Order)
// ==========================================

router.get('/cart', (req, res) => {
    const cart = req.session.cart || [];
    res.render('cart', { 
        title: 'ตะกร้าสินค้าของคุณ', cart: cart,
        login: req.session.login, user: req.session.user, session: req.session 
    });
});
//สำหรับ FORM
router.post('/cart/add', async (req, res) => {
    // 1. ตรวจสอบค่าที่ส่งมาจากฟอร์ม
    const pId = req.body.productId; // รับค่าตรงๆ
    const qty = parseInt(req.body.quantity) || 1;

    try {
        const productData = await Product.findById(pId);
        if (!productData) return res.redirect('/');

        if (!req.session.cart) req.session.cart = [];

        // 2. เช็คสินค้าในตะกร้า (ใช้ .toString() ทั้งสองฝั่ง)
        const itemIndex = req.session.cart.findIndex(item => 
            item.id.toString() === pId.toString()
        );

        if (itemIndex > -1) {
            req.session.cart[itemIndex].quantity += qty;
        } else {
            // 3. เพิ่มสินค้าใหม่
            req.session.cart.push({
                id: productData._id.toString(), // เก็บเป็น String
                name: productData.name,
                price: productData.price,
                image: productData.image,
                quantity: qty
            });
        }
        
        // 4. บันทึก session ให้ชัวร์ก่อน redirect (บางครั้ง Express-session บันทึกไม่ทัน)
        req.session.save(() => {
            res.redirect('/cart');
        });

    } catch (err) {
        console.error("Cart Add Error:", err);
        res.redirect('/');
    }
});
//สำหรับ คลิกเพิ่ม

router.get('/cart/add/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        const productData = await Product.findById(productId);
        if (!productData) return res.redirect('/');

        if (!req.session.cart) req.session.cart = [];

        // ✨ แก้ไขจุดนี้: ใช้ .toString() เพื่อให้เปรียบเทียบ ID ได้ถูกต้องไม่ว่าจะ Login หรือไม่
        const itemIndex = req.session.cart.findIndex(item => item.id.toString() === productId.toString());

        if (itemIndex > -1) {
            req.session.cart[itemIndex].quantity += 1;
        } else {
            req.session.cart.push({
                id: productData._id.toString(), // เก็บเป็น String ไว้เลย
                name: productData.name,
                price: productData.price,
                image: productData.image,
                quantity: 1
            });
        }
        res.redirect('/cart');
    } catch (err) {
        res.redirect('/');
    }
});



router.get("/cart/remove/:id", (req, res) => {
    const productId = req.params.id;
    if (req.session.cart) {
        
        req.session.cart = req.session.cart.filter(item => 
            item.id.toString() !== productId.toString()
        );
    }
    res.redirect("/cart");
});

router.get("/checkout", (req, res) => {
    let total = 0;
    if (req.session.cart) {
        req.session.cart.forEach(item => total += (item.price * item.quantity));
    }
    res.render("checkout", { 
        title: "ชำระเงิน", total: total, user: req.session.user || {} 
    });
});

// ✨ จุดแก้ไข: ทำให้รายงาน Real-time เมื่อกดสั่งซื้อ
router.post("/confirm-order", async (req, res) => {
    try {
        const { paymentMethod } = req.body;
        const cart = req.session.cart;

        if (cart && cart.length > 0) {
            // วนลูปบันทึกสินค้าจากตะกร้าลงในฐานข้อมูล Sale ทีละชิ้น
            for (let item of cart) {
                const newSale = new Sale({
                    product: item.id,
                    member: req.session.user ? req.session.user.id : null,
                    quantity: item.quantity,
                    totalPrice: item.price * item.quantity
                });
                await newSale.save(); 
            }
        }

        // ล้างตะกร้า
        req.session.cart = [];
        res.send(`
            <script>
                alert('การสั่งซื้อสำเร็จ! ข้อมูลถูกบันทึกลงรายงานเรียบร้อย');
                window.location.href = '/report';
            </script>
        `);
    } catch (err) {
        res.status(500).send("เกิดข้อผิดพลาดในการบันทึกการสั่งซื้อ");
    }
});

// ==========================================
// 🔐 ส่วนที่ 5: ระบบสมาชิก (Login & Register)
// ==========================================

router.get("/register", (req, res) => { res.render("register/regisindex"); });

router.post("/register", async (req , res)=>{
    const { name, email, phone, password, confirmPassword } = req.body;
    const formData = { name, email, phone };

    if (password !== confirmPassword) {
        return res.render("register/regisindex", { error: "password do not match ", data: formData });
    }
    try {
        const existingUser = await Member.findOne({ email: email });
        if (existingUser) {
            return res.render("register/regisindex", { error: "Email already exists", data: formData });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newMember = new Member({
            name, email, phone, password: hashedPassword,
        });
        await newMember.save();
        res.redirect("/login");
    } catch (error) {
        res.render("register/regisindex", { error: "Error Registering user", data: formData });
    }
});

// --- ระบบลืมรหัสผ่าน (เพิ่มใหม่) ---

router.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { title: "ลืมรหัสผ่าน" });
});

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await Member.findOne({ email: email });
        if (!user) {
            return res.send(`
                <script>
                    alert('ไม่พบอีเมลนี้ในระบบ');
                    window.location.href = '/forgot-password';
                </script>
            `);
        }
        
        // ในขั้นตอนนี้ ปกติจะมีการสร้าง Token และส่งอีเมล
        // แต่เพื่อความง่ายเบื้องต้น ให้แสดงข้อความจำลองก่อนครับ
        res.send(`
            <script>
                alert('ระบบได้ส่งคำแนะนำการกู้คืนรหัสผ่านไปยัง ${email} เรียบร้อยแล้ว (Demo Only)');
                window.location.href = '/login';
            </script>
        `);
    } catch (err) {
        res.status(500).send("Error");
    }
});

router.get("/login", (req, res) => { res.render("login", { message: req.session.message }); });

router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await Member.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
        req.session.message = "Invalid Email or Password!";
        return res.redirect("/login");
    }

    req.session.login = true;
    req.session.user = { id: user._id, name: user.name, role: user.role };
    res.redirect("/");
});

router.get("/logout", (req, res) => {
    req.session.destroy(() => { res.redirect("/login"); });
});

// ==========================================
//  ส่วนที่ 6: ระบบจัดการและรายงาน (Admin/Staff Only)
// ==========================================

// หน้า Report (Real-time ดึงจาก DB)

router.get('/report', isStaff, async (req, res) => {
    try {
        // 2. ดึงข้อมูลจาก Model Sale และดึงข้อมูล Product ที่เชื่อมกันมาด้วย
        const allSales = await Sale.find().populate('product').sort({ date: -1 });

        let totalSales = 0;
        const brandMap = {};

        const processedSales = allSales.map(sale => {
            // เช็คว่าสินค้ายังอยู่ในระบบไหม (เผื่อถูกลบ)
            const hasProduct = sale.product != null;
            const price = sale.totalPrice || 0;
            const brand = hasProduct ? sale.product.brand : 'สินค้าถูกลบแล้ว';
            
            totalSales += price;

            // เก็บสถิติแยกตามยี่ห้อ
            if (hasProduct) {
                brandMap[brand] = (brandMap[brand] || 0) + price;
            }

            return {
                date: sale.date,
                productName: hasProduct ? sale.product.name : 'สินค้าถูกลบแล้ว',
                brand: brand,
                price: price,
                image: hasProduct ? sale.product.image : null
            };
        });

        // แปลง Brand Summary เป็น Array
        const topBrands = Object.keys(brandMap).map(name => ({
            name: name,
            amount: brandMap[name]
        })).sort((a, b) => b.amount - a.amount);

        const data = {
            totalSales: totalSales,
            totalOrders: allSales.length,
            topBrands: topBrands,
            recentSales: processedSales.slice(0, 10) // เอาแค่ 10 รายการล่าสุด
        };

        res.render('report', { data: data });
    } catch (err) {
        console.error(err);
        res.status(500).send("เกิดข้อผิดพลาด: " + err.message);
    }
});
// --- หน้าดึงข้อมูลมาเเก้ไข
router.post('/edit', isStaff, async (req, res) => {
    try {
        const edit_id = req.body.id; // รับ ID สินค้าจาก <input type="hidden" name="id">
        const product = await Product.findOne({ _id: edit_id }).exec();
        
        res.render('formedit', { 
            product: product, 
            title: "แก้ไขข้อมูลสินค้า" 
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("ไม่พบข้อมูลสินค้าที่ต้องการแก้ไข");
    }
});

//  หน้าสำหรับรับข้อมูลที่แก้ไขเสร็จแล้ว บันทึกลง Database 
router.post('/update', isStaff, upload.single("image"), async (req, res) => {
    try {
        const id = req.body.id;
        const data = {
            name: req.body.name,
            price: Number(req.body.price),
            oldPrice: Number(req.body.oldPrice),
            brand: req.body.brand,
            description: req.body.description
        };

        // ถ้ามีการอัปโหลดรูปใหม่ ให้เปลี่ยนชื่อไฟล์รูปใน data ด้วย
        if (req.file) {
            data.image = req.file.filename;
        }

        await Product.findByIdAndUpdate(id, data, { useFindAndModify: false }).exec();
        res.redirect('/manage'); // แก้ไขเสร็จแล้วเด้งกลับหน้าจัดการ
    } catch (error) {
        console.error(error);
        res.status(500).send("บันทึกข้อมูลการแก้ไขไม่สำเร็จ");
    }
});

// --- ส่วนลบข้อมูลสินค้า ---
// 
router.get('/delete/:id', isStaff, async (req, res) => {
    try {
        const id = req.params.id; // ดึง ID จาก URL
        
        // คำสั่งลบใน MongoDB
        await Product.findByIdAndDelete(id, { useFindAndModify: false }).exec();
        
        // ลบเสร็จแล้วให้เด้งกลับไปหน้าจัดการสินค้า
        res.redirect('/manage'); 
    } catch (err) {
        console.error(err);
        res.status(500).send("เกิดข้อผิดพลาดในการลบสินค้า");
    }
});

// จัดการสมาชิก
router.get("/members", isOwner, async (req, res) => {
    try {
        const members = await Member.find();
        res.render("manageMembers", { members: members, title: "Manage Members" });
    } catch (error) { res.status(500).send("Error"); }
});

// --- ส่วนลบข้อมูลสมาชิก (Admin Only) ---
router.get('/members/delete/:id', isOwner, async (req, res) => {
    try {
        const id = req.params.id;
        // ป้องกันเจ้าของร้านลบตัวเอง (เช็คจาก Session)
        if (id === req.session.user.id) {
            return res.send("<script>alert('คุณไม่สามารถลบบัญชีของตัวเองได้'); window.location.href='/members';</script>");
        }

        await Member.findByIdAndDelete(id).exec();
        res.redirect('/members'); 
    } catch (err) {
        console.error(err);
        res.status(500).send("เกิดข้อผิดพลาดในการลบสมาชิก");
    }
});

// --- 1. หน้าดึงข้อมูลสมาชิกมาแสดงในฟอร์มแก้ไข ---
router.get('/members/edit/:id', isOwner, async (req, res) => {
    try {
        const id = req.params.id;
        const member = await Member.findById(id).exec();
        res.render('editMember', { 
            member: member, 
            title: "แก้ไขข้อมูลสมาชิก" 
        });
    } catch (error) {
        res.status(500).send("ไม่พบข้อมูลสมาชิก");
    }
});

// --- 2. รับข้อมูลที่แก้ไขแล้วบันทึกลง Database ---
router.post('/members/update', isOwner, async (req, res) => {
    try {
        const { id, name, email, phone, role } = req.body;
        const data = { name, email, phone, role };

        await Member.findByIdAndUpdate(id, data).exec();
        res.redirect('/members'); // แก้เสร็จเด้งกลับหน้าจัดการสมาชิก
    } catch (error) {
        res.status(500).send("บันทึกข้อมูลไม่สำเร็จ");
    }
});

router.post("/update-role", isOwner, async (req, res) => {
    try {
        const { userId, newRole } = req.body;
        await Member.findByIdAndUpdate(userId, { role: newRole });
        res.redirect("/members");
    } catch (error) { res.status(500).send("Update failed"); }
});

// จัดการสินค้า
router.get('/manage', isStaff, async (req, res) => {
    try {
        const products = await Product.find(); 
        res.render("manage", { products: products, title: "Manage Product" }); 
    } catch (error) { res.status(500).send("Error"); }
});

router.post('/insert', upload.single("image"), async (req, res) => {
    try {
        const newProduct = new Product({ 
            name: req.body.name, 
            price: Number(req.body.price), 
            oldPrice: Number(req.body.oldPrice) || Number(req.body.price),
            image: req.file ? req.file.filename : "nopic.png", 
            brand: req.body.brand,
            description: req.body.description 
        });
        await newProduct.save();
        res.redirect('/manage');
    } catch (error) { res.status(500).send("Error"); }     
});

// การขายแบบ Manual (จากฟอร์มหลังบ้าน)
router.post("/sales/insert", async (req, res) => {
    const { product, member, quantity } = req.body;
    const productData = await Product.findById(product);
    const totalPrice = productData.price * quantity;
    const newSale = new Sale({ product, member, quantity, totalPrice });
    await newSale.save();
    res.redirect("/sales/all");
});

router.get("/sales/all", isStaff, async(req,res) =>{
    const sales = await Sale.find().populate("product").populate("member");
    res.render("sales/showsale" , {sales});
});

// ==========================================
//  ส่วนที่ 7: ระบบค้นหาและดูรายละเอียด (ท้ายสุด)
// ==========================================

router.get('/addForm', (req, res) => { res.render('form', { title: "Add New Product" }); });

router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        res.render("product", { product: product, title: "Product Detail" }); 
    } catch (error) { res.redirect('/'); }
});

module.exports = router;