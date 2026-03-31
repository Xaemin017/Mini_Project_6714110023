function openDoomModal() {
    document.getElementById('doomModal').style.display = 'block';
    
    // เริ่มรันเกม
    Dos(document.getElementById("jsdos"))
      .run("https://cdn.dos.zone/original/2X/b/be0b7017684617a94464f8c983411b418a000570.jsdos");
}

function closeDoomModal() {
    // ปิดหน้าต่างแล้วหยุดเกม (Refresh หน้าเพื่อเคลียร์ Memory ก็ได้ถ้าเครื่องอืด)
    document.getElementById('doomModal').style.display = 'none';
    location.reload(); 
}