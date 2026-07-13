const pool = require('../config/database.cjs');
const { success, error } = require('../utils/helpers.cjs');
module.exports = {
  async list(req,res){try{const admin=req.user?.role==='admin';const [rows]=await pool.query(`SELECT * FROM concessions ${admin?'':"WHERE status='ACTIVE' AND stock>0"} ORDER BY name`);return success(res,rows);}catch(e){return error(res,e.message,500);}},
  async save(req,res){try{const {name,description,price,image,stock,status}=req.body;const id=req.params.id||req.body.id;if(!id||!name||!Number.isFinite(Number(price))||Number(price)<0||!Number.isFinite(Number(stock))||Number(stock)<0)return error(res,'Dữ liệu không hợp lệ',400);await pool.query(`INSERT INTO concessions(id,name,description,price,image,stock,status) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),description=VALUES(description),price=VALUES(price),image=VALUES(image),stock=VALUES(stock),status=VALUES(status)`,[id.trim(),name.trim(),description||'',Number(price),image||'',Number(stock),status||'ACTIVE']);return success(res,{id},'Đã lưu sản phẩm');}catch(e){return error(res,e.message,500);}},
  async remove(req,res){try{const [result]=await pool.query('DELETE FROM concessions WHERE id=?',[req.params.id]);if(!result.affectedRows)return error(res,'Không tìm thấy sản phẩm',404);return success(res,null,'Đã xóa sản phẩm');}catch(e){return error(res,e.message,500);}}
};
