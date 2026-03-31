const mongoose = require('mongoose')

// ออกแบบ Schema ใหม่ให้รองรับการกรองยี่ห้อและระบบขาย
let productSchema = mongoose.Schema({
   name: String,
    price: Number,      // ราคาขายปัจจุบัน (ราคาโปรโมชั่น)
    oldPrice: Number,   // ราคาเต็ม (ราคาเดิม) ✨ เพิ่มส่วนนี้
    image: String,
    brand: String,
    description: String
})

// สร้าง Model
let Product = mongoose.model("products", productSchema)

// ส่งออก Model
module.exports = Product

// ฟังก์ชันบันทึกข้อมูล (ปรับปรุงให้รองรับ async/await เพื่อความเสถียร)
module.exports.saveProduct = function(model, data){
    return model.save(data)
}