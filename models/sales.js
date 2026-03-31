const mongoose = require("mongoose");

const SaleSchema = new mongoose.Schema({
    product: {type: mongoose.Schema.Types.ObjectId , ref: "products"},
      member: {type: mongoose.Schema.Types.ObjectId , ref: "member"},
      quantity: Number,
      totalPrice:Number,
      date: {type: Date , default: Date.now}

});

module.exports = mongoose.model("Sale" , SaleSchema);

module.exports.saveSale = function(model , data){
    model.save(data);
}