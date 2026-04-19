document.getElementById('internalForm').addEventListener('submit', function(e) {
    e.preventDefault();

    // Thu thập dữ liệu
    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());

    // Vì tất cả input đều có thuộc tính 'required', 
    // trình duyệt sẽ tự ngăn chặn nếu chưa nhập đủ.
    
    console.log("Dữ liệu đã lưu:", data);
    
    alert("✅ Thành công! Dữ liệu đã được ghi nhận hệ thống.");
    
    // Tùy chọn: Xóa sạch form sau khi lưu
    // this.reset();
});