// عرض تفاصيل موظف
window.viewEmployee = async function(id) {
    try {
        const detailsElement = document.getElementById('employeeDetails');
        const modal = document.getElementById('employeeModal');
        
        if (!detailsElement || !modal) return;
        
        // جلب بيانات الموظف
        const { data: user, error } = await sb.from('users')
            .select('*, work_shifts(name)')
            .eq('id', id)
            .single();
        
        if (error) throw error;

        // تجهيز صورة الموظف
        const photoDisplay = user.photo_url 
            ? `<img src="${user.photo_url}" alt="صورة الموظف" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary);">`
            : `<div style="width: 120px; height: 120px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 3rem; color: white; font-weight: bold;">${(user.full_name || user.email).charAt(0).toUpperCase()}</div>`;

        // تجهيز المحتوى
        detailsElement.innerHTML = `
            <div class="employee-info">
                <div class="employee-header">
                    ${photoDisplay}
                    <div class="employee-basic-info">
                        <h3>${user.full_name || user.email}</h3>
                        <p>${user.position || 'غير محدد'} - ${user.department || 'غير محدد'}</p>
                        <span class="status ${user.status === 'active' ? 'status-active' : 'status-inactive'}">
                            ${user.status === 'active' ? 'نشط' : 'غير نشط'}
                        </span>
                    </div>
                </div>
                
                <div class="info-section">
                    <h4><i class="fas fa-info-circle"></i> معلومات الاتصال</h4>
                    <div class="info-grid">
                        <div>
                            <span>البريد الإلكتروني</span>
                            <strong>${user.email}</strong>
                        </div>
                        <div>
                            <span>رقم الهاتف</span>
                            <strong>${user.phone || '-'}</strong>
                        </div>
                        ${user.national_id ? `
                        <div>
                            <span>الرقم القومي</span>
                            <strong>${user.national_id}</strong>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="info-section">
                    <h4><i class="fas fa-briefcase"></i> معلومات الوظيفة</h4>
                    <div class="info-grid">
                        <div>
                            <span>القسم</span>
                            <strong>${user.department || '-'}</strong>
                        </div>
                        <div>
                            <span>المسمى الوظيفي</span>
                            <strong>${user.position || '-'}</strong>
                        </div>
                        <div>
                            <span>نوع الشيفت</span>
                            <strong>${user.work_shifts?.name || 'غير محدد'}</strong>
                        </div>
                        <div>
                            <span>الدور</span>
                            <strong>${user.role === 'admin' ? 'مدير' : 'موظف'}</strong>
                        </div>
                    </div>
                </div>
                
                <div class="info-section salary-info">
                    <h4><i class="fas fa-money-bill-wave"></i> معلومات الراتب</h4>
                    <div class="info-grid">
                        <div>
                            <span>الراتب الأساسي</span>
                            <strong>${user.basic_salary ? user.basic_salary.toFixed(2) + ' ج.م' : '-'}</strong>
                        </div>
                        ${user.hourly_rate ? `
                        <div>
                            <span>الأجر بالساعة</span>
                            <strong>${user.hourly_rate.toFixed(2)} ج.م</strong>
                        </div>
                        ` : ''}
                        ${user.hire_date ? `
                        <div>
                            <span>تاريخ التعيين</span>
                            <strong>${new Date(user.hire_date).toLocaleDateString('ar-EG')}</strong>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        // عرض المودال
        document.body.style.overflow = 'hidden';
        modal.classList.add('active');
        
    } catch (error) {
        console.error('Error loading employee details:', error);
        showNotification('حدث خطأ أثناء تحميل تفاصيل الموظف', 'error');
    }
}

// إغلاق المودال
window.closeEmployeeModal = function() {
    const modal = document.getElementById('employeeModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}