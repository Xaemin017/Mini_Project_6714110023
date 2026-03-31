const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // ใช้ bcryptjs ให้ตรงกับใน myrouter.js

const MemberSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    // เพิ่ม Role ตรงนี้
    role: { 
        type: String, 
        enum: ['customer', 'staff', 'owner'], 
        default: 'customer' 
    }
}, { timestamps: true }); // แนะนำให้ใส่ timestamps เพื่อดูวันที่สมัครสมาชิกได้

MemberSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("member", MemberSchema);