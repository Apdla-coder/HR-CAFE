// admin-functions.js - جميع وظائف لوحة تحكم المدير

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://nxhnivykhlnauewpmuqv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54aG5pdnlraGxuYXVld3BtdXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4Mjk2NTYsImV4cCI6MjA3NDQwNTY1Nn0.-3ps3Mp7aYuA2m54sW3gNN3CpZ2acRtKGj8jI5eHTOU";
const sb = createClient(supabaseUrl, supabaseKey);

let currentEditingId = null;

// =============== دوال مساعدة ===============
function showNotification(text, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    if (notification && notificationText) {
        notificationText.textContent = text;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 5000);
    }
}

// =============== التحقق من الصلاحيات ===============
async function checkAdminSession() {
    const { data: { session }, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !session) {
        window.location.href = 'index.html';
        return null;
    }

    const { data: userData, error } = await sb
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (error || !userData || userData.role !== 'admin') {
        await sb.auth.signOut();
        window.location.href = 'index.html';
        return null;
    }

    const adminNameEl = document.getElementById('adminName');
    if (adminNameEl) {
        adminNameEl.textContent = userData.full_name || userData.email;
    }
    
    return session;
}

// =============== تحميل الإحصائيات ===============
async function loadStats() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const [usersResult, leavesResult, attendanceResult] = await Promise.all([
            sb.from('users').select('id, status, role'),
            sb.from('leaves').select('id').eq('status', 'pending'),
            sb.from('attendance').select('id').eq('date', today)
        ]);

        const users = usersResult.data || [];
        const totalEmployees = users.filter(u => u.role === 'employee').length;
        const activeEmployees = users.filter(u => u.status === 'active' && u.role === 'employee').length;
        
        document.getElementById('totalEmployees').textContent = totalEmployees;
        document.getElementById('activeEmployees').textContent = activeEmployees;
        document.getElementById('pendingLeaves').textContent = leavesResult.data?.length || 0;
        document.getElementById('todayAttendance').textContent = attendanceResult.data?.length || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// =============== إدارة الموظفين ===============
async function loadUsers() {
    const section = document.getElementById('employeesSection');
    section.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>جاري التحميل...</p></div>';

    try {
        const { data: users, error } = await sb
            .from('users')
            .select('id, full_name, email, department, position, status, role, photo_url, shift_type_id, work_shifts(name)')
            .eq('role', 'employee')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!users || users.length === 0) {
            section.innerHTML = `
                <div class="table-wrapper">
                    <div class="table-header">
                        <h3>قائمة الموظفين</h3>
                        <button class="btn btn-primary" onclick="window.adminFunctions.openAddEmployeeModal()">
                            <i class="fas fa-plus"></i> إضافة موظف
                        </button>
                    </div>
                    <div class="empty-state">
                        <i class="fas fa-users fa-2x"></i>
                        <p>لا يوجد موظفين</p>
                    </div>
                </div>`;
            return;
        }

        let html = `
            <div class="table-wrapper">
                <div class="table-header">
                    <h3>قائمة الموظفين (${users.length})</h3>
                    <button class="btn btn-primary" onclick="window.adminFunctions.openAddEmployeeModal()">
                        <i class="fas fa-plus"></i> إضافة موظف
                    </button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>الاسم</th>
                            <th>البريد</th>
                            <th>القسم</th>
                            <th>المسمى</th>
                            <th>نوع الشيفت</th>
                            <th>الحالة</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>`;

        users.forEach(user => {
            const statusClass = user.status === 'active' ? 'status-active' : 'status-inactive';
            const statusText = user.status === 'active' ? 'نشط' : 'غير نشط';
            const photoUrl = user.photo_url || 'default-avatar.png.jpg';

            html += `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <img src="${photoUrl}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                            ${user.full_name || '-'}
                        </div>
                    </td>
                    <td>${user.email}</td>
                    <td>${user.department || '-'}</td>
                    <td>${user.position || '-'}</td>
                    <td>${user.work_shifts?.name || 'غير محدد'}</td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-primary" onclick="window.adminFunctions.viewEmployee('${user.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-warning" onclick="window.adminFunctions.editEmployee('${user.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger" onclick="window.adminFunctions.deleteEmployee('${user.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        });

        html += '</tbody></table></div>';
        section.innerHTML = html;
    } catch (error) {
        console.error('Error loading users:', error);
        section.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle fa-2x"></i><p>حدث خطأ في تحميل البيانات</p></div>';
    }
}

window.openAddEmployeeModal = async function() {
    currentEditingId = null;
    document.getElementById('employeeModalTitle').innerHTML = '<i class="fas fa-user-plus"></i> إضافة موظف جديد';
    document.getElementById('employeeForm').reset();
    document.getElementById('empPassword').disabled = false;
    document.getElementById('empPassword').required = true;
    document.getElementById('employeeModal').classList.add('show');
    
    await loadDepartments();
    await loadShifts();
};

async function loadDepartments() {
    const depSelect = document.getElementById("empDepartment");
    const posSelect = document.getElementById("empPosition");
    if (!depSelect || !posSelect) return;

    const { data: deps } = await sb.from("departments").select("id, name");
    const { data: positions } = await sb.from("positions").select("id, name");

    depSelect.innerHTML = '<option value="">اختر القسم</option>';
    deps?.forEach(dep => {
        depSelect.innerHTML += `<option value="${dep.name}">${dep.name}</option>`;
    });

    posSelect.innerHTML = '<option value="">اختر المسمى الوظيفي</option>';
    positions?.forEach(pos => {
        posSelect.innerHTML += `<option value="${pos.name}">${pos.name}</option>`;
    });
}

async function loadShifts() {
    const shiftSelect = document.getElementById("empShift");
    if (!shiftSelect) return;

    const { data: shifts } = await sb.from("work_shifts").select("id, name, hours_per_day");
    shiftSelect.innerHTML = '<option value="">اختر الشيفت</option>';
    shifts?.forEach(shift => {
        shiftSelect.innerHTML += `<option value="${shift.id}">${shift.name} - ${shift.hours_per_day} ساعات</option>`;
    });
}

window.viewEmployee = async function(id) {
    try {
        const { data: user, error } = await sb
            .from('users')
            .select('*, work_shifts(name)')
            .eq('id', id)
            .single();
        
        if (error) throw error;

        const photoUrl = user.photo_url || 'default-avatar.png.jpg';
        const details = `
            <div style="padding: 1rem;">
                <div style="display: flex; align-items: center; margin-bottom: 1.5rem;">
                    <img src="${photoUrl}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-left: 1rem;">
                    <div>
                        <h3>${user.full_name || user.email}</h3>
                        <p style="color: #6c757d;">${user.position || 'غير محدد'} - ${user.department || 'غير محدد'}</p>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                    <div>
                        <p><strong>البريد:</strong> ${user.email}</p>
                        <p><strong>الهاتف:</strong> ${user.phone || '-'}</p>
                        <p><strong>القسم:</strong> ${user.department || '-'}</p>
                    </div>
                    <div>
                        <p><strong>المسمى:</strong> ${user.position || '-'}</p>
                        <p><strong>الشيفت:</strong> ${user.work_shifts?.name || 'غير محدد'}</p>
                        <p><strong>الراتب:</strong> ${user.basic_salary ? user.basic_salary + ' ج.م' : '-'}</p>
                    </div>
                </div>
            </div>`;

        document.getElementById('employeeDetails').innerHTML = details;
        document.getElementById('viewEmployeeModal').classList.add('show');
    } catch (error) {
        console.error('Error:', error);
        showNotification('حدث خطأ في تحميل البيانات', 'error');
    }
};

window.editEmployee = async function(id) {
    try {
        const { data: user, error } = await sb
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        currentEditingId = id;
        document.getElementById('employeeModalTitle').innerHTML = '<i class="fas fa-user-edit"></i> تعديل بيانات الموظف';
        
        await loadDepartments();
        await loadShifts();

        document.getElementById('empEmail').value = user.email || '';
        document.getElementById('empName').value = user.full_name || '';
        document.getElementById('empPhone').value = user.phone || '';
        document.getElementById('empNationalId').value = user.national_id || '';
        document.getElementById('empDepartment').value = user.department || '';
        document.getElementById('empPosition').value = user.position || '';
        document.getElementById('empShift').value = user.shift_type_id || '';
        document.getElementById('empSalary').value = user.basic_salary || '';
        document.getElementById('empStatus').value = user.status || 'active';
        document.getElementById('empPassword').value = '';
        document.getElementById('empPassword').disabled = false;
        document.getElementById('empPassword').required = false;
        
        document.getElementById('employeeModal').classList.add('show');
    } catch (error) {
        console.error('Error:', error);
        showNotification('حدث خطأ في تحميل البيانات', 'error');
    }
};

window.deleteEmployee = async function(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الموظف؟ سيتم حذف جميع البيانات المرتبطة به.')) return;

    try {
        await sb.from('attendance').delete().eq('user_id', id);
        await sb.from('leaves').delete().eq('user_id', id);
        await sb.from('salary_calculations').delete().eq('user_id', id);
        
        const { error } = await sb.from('users').delete().eq('id', id);
        if (error) throw error;

        showNotification('تم حذف الموظف بنجاح', 'success');
        await loadUsers();
        await loadStats();
    } catch (error) {
        console.error('Error:', error);
        showNotification('حدث خطأ أثناء الحذف: ' + error.message, 'error');
    }
};

// معالجة نموذج الموظف
document.getElementById('employeeForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const messageDiv = document.getElementById('employeeMessage');
    messageDiv.style.display = 'none';

    const email = document.getElementById('empEmail').value;
    const fullName = document.getElementById('empName').value;
    const phone = document.getElementById('empPhone').value;
    const nationalId = document.getElementById('empNationalId').value;
    const department = document.getElementById('empDepartment').value;
    const position = document.getElementById('empPosition').value;
    const shiftTypeId = document.getElementById('empShift').value;
    const salary = document.getElementById('empSalary').value;
    const status = document.getElementById('empStatus').value;
    const password = document.getElementById('empPassword').value;
    const photoFile = document.getElementById('empPhoto').files[0];

    try {
        let photoUrl = null;
        
        if (photoFile) {
            const fileExt = photoFile.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `employee_photos/${fileName}`;

            const { data: uploadData, error: uploadError } = await sb.storage
                .from('employee-files')
                .upload(filePath, photoFile);

            if (!uploadError) {
                const { data: urlData } = sb.storage
                    .from('employee-files')
                    .getPublicUrl(filePath);
                photoUrl = urlData.publicUrl;
            }
        }

        if (currentEditingId) {
            const updateData = {
                full_name: fullName,
                phone: phone,
                national_id: nationalId || null,
                department: department,
                position: position,
                shift_type_id: shiftTypeId ? parseInt(shiftTypeId) : null,
                basic_salary: salary ? parseFloat(salary) : null,
                status: status,
                updated_at: new Date().toISOString()
            };

            if (photoUrl) updateData.photo_url = photoUrl;

            const { error } = await sb.from('users').update(updateData).eq('id', currentEditingId);
            if (error) throw error;

            messageDiv.className = 'message success';
            messageDiv.textContent = 'تم تحديث بيانات الموظف بنجاح';
            messageDiv.style.display = 'block';

            setTimeout(() => {
                window.closeEmployeeModal();
                loadUsers();
                loadStats();
            }, 1500);

        } else {
            if (!password) {
                messageDiv.className = 'message error';
                messageDiv.textContent = 'يجب إدخال كلمة مرور للموظف الجديد';
                messageDiv.style.display = 'block';
                return;
            }

            const { data: authData, error: authError } = await sb.auth.signUp({
                email: email,
                password: password,
                options: { data: { role: "employee" } }
            });

            if (authError) throw authError;

            const userId = authData.user?.id;
            if (!userId) throw new Error('فشل الحصول على معرف المستخدم');

            const insertData = {
                id: userId,
                full_name: fullName,
                email: email,
                phone: phone,
                national_id: nationalId || null,
                department: department,
                position: position,
                shift_type_id: shiftTypeId ? parseInt(shiftTypeId) : null,
                basic_salary: salary ? parseFloat(salary) : null,
                role: 'employee',
                status: status,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            if (photoUrl) insertData.photo_url = photoUrl;

            const { error: insertError } = await sb.from('users').insert([insertData]);
            if (insertError) throw insertError;

            messageDiv.className = 'message success';
            messageDiv.textContent = 'تم إضافة الموظف بنجاح';
            messageDiv.style.display = 'block';

            setTimeout(() => {
                window.closeEmployeeModal();
                loadUsers();
                loadStats();
            }, 1500);
        }
    } catch (error) {
        console.error('Error:', error);
        messageDiv.className = 'message error';
        messageDiv.textContent = 'حدث خطأ: ' + error.message;
        messageDiv.style.display = 'block';
    }
});

window.closeEmployeeModal = function() {
    document.getElementById('employeeModal').classList.remove('show');
    document.getElementById('employeeForm').reset();
    currentEditingId = null;
};

window.closeViewEmployeeModal = function() {
    document.getElementById('viewEmployeeModal').classList.remove('show');
};

window.previewEmployeePhoto = function(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 2 * 1024 * 1024) {
            showNotification('حجم الصورة يجب ألا يتجاوز 2 ميجا', 'error');
            event.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('empPhotoPreview');
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
};

// =============== إدارة الحضور ===============
async function loadAttendance() {
    const section = document.getElementById('attendanceSection');
    section.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>جاري التحميل...</p></div>';

    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const startDate = thirtyDaysAgo.toISOString().split('T')[0];

        const { data: attendance, error } = await sb
            .from('attendance')
            .select('*, users(full_name, email)')
            .gte('date', startDate)
            .order('date', { ascending: false });

        if (error) throw error;

        if (!attendance || attendance.length === 0) {
            section.innerHTML = '<div class="empty-state"><i class="fas fa-clock fa-2x"></i><p>لا يوجد سجلات حضور</p></div>';
            return;
        }

        let html = `
            <div class="table-wrapper">
                <div class="table-header">
                    <h3>سجل الحضور والانصراف (آخر 30 يوم)</h3>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>الموظف</th>
                            <th>التاريخ</th>
                            <th>وقت الحضور</th>
                            <th>وقت الانصراف</th>
                            <th>عدد الساعات</th>
                            <th>الحالة</th>
                        </tr>
                    </thead>
                    <tbody>`;

        attendance.forEach(record => {
            let checkIn = record.check_in ? new Date(`1970-01-01T${record.check_in}`).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-';
            let checkOut = record.check_out ? new Date(`1970-01-01T${record.check_out}`).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-';
            
            let hours = '-';
            if (record.check_in && record.check_out) {
                const inTime = new Date(`1970-01-01T${record.check_in}`);
                const outTime = new Date(`1970-01-01T${record.check_out}`);
                const diff = (outTime - inTime) / (1000 * 60 * 60);
                hours = diff.toFixed(2);
            }

            const statusClass = record.check_out ? 'status-active' : 'status-pending';
            const statusText = record.check_out ? 'مكتمل' : 'جاري العمل';

            html += `
                <tr>
                    <td>${record.users?.full_name || record.users?.email || '-'}</td>
                    <td>${new Date(record.date).toLocaleDateString('ar-EG')}</td>
                    <td>${checkIn}</td>
                    <td>${checkOut}</td>
                    <td>${hours}</td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                </tr>`;
        });

        html += '</tbody></table></div>';
        section.innerHTML = html;
    } catch (error) {
        console.error('Error:', error);
        section.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle fa-2x"></i><p>حدث خطأ في تحميل البيانات</p></div>';
    }
}

// =============== إدارة الإجازات ===============
async function loadLeaves() {
    const section = document.getElementById('leavesSection');
    section.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>جاري التحميل...</p></div>';

    try {
        const { data: leaves, error } = await sb
            .from('leaves')
            .select('*, users(full_name, email)')
            .order('start_date', { ascending: false });

        if (error) throw error;

        if (!leaves || leaves.length === 0) {
            section.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-alt fa-2x"></i><p>لا يوجد طلبات إجازات</p></div>';
            return;
        }

        let html = `
            <div class="table-wrapper">
                <div class="table-header">
                    <h3>طلبات الإجازات</h3>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>الموظف</th>
                            <th>نوع الإجازة</th>
                            <th>من تاريخ</th>
                            <th>إلى تاريخ</th>
                            <th>السبب</th>
                            <th>الحالة</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>`;

        leaves.forEach(leave => {
            const statusMap = {
                pending: { class: 'status-pending', text: 'معلق' },
                approved: { class: 'status-approved', text: 'موافق' },
                rejected: { class: 'status-rejected', text: 'مرفوض' }
            };
            const status = statusMap[leave.status] || statusMap.pending;

            const leaveTypeMap = {
                annual: 'إجازة سنوية',
                sick: 'إجازة مرضية',
                emergency: 'إجازة طارئة',
                unpaid: 'إجازة بدون راتب'
            };

            html += `
                <tr>
                    <td>${leave.users?.full_name || leave.users?.email || '-'}</td>
                    <td>${leaveTypeMap[leave.type] || leave.type}</td>
                    <td>${new Date(leave.start_date).toLocaleDateString('ar-EG')}</td>
                    <td>${new Date(leave.end_date).toLocaleDateString('ar-EG')}</td>
                    <td>${leave.reason || '-'}</td>
                    <td><span class="status ${status.class}">${status.text}</span></td>
                    <td>
                        <div class="action-buttons">
                            ${leave.status === 'pending' ? `
                                <button class="btn btn-success" onclick="window.adminFunctions.approveLeave('${leave.id}')">
                                    <i class="fas fa-check"></i>
                                </button>
                                <button class="btn btn-danger" onclick="window.adminFunctions.rejectLeave('${leave.id}')">
                                    <i class="fas fa-times"></i>
                                </button>
                            ` : '<span style="color: #999;">تم المعالجة</span>'}
                        </div>
                    </td>
                </tr>`;
        });

        html += '</tbody></table></div>';
        section.innerHTML = html;
    } catch (error) {
        console.error('Error:', error);
        section.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle fa-2x"></i><p>حدث خطأ في تحميل البيانات</p></div>';
    }
}

window.approveLeave = async function(id) {
    if (!confirm('هل أنت متأكد من الموافقة على هذه الإجازة؟')) return;

    try {
        const { error } = await sb
            .from('leaves')
            .update({ 
                status: 'approved',
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        showNotification('تم الموافقة على الإجازة بنجاح', 'success');
        await loadLeaves();
        await loadStats();
    } catch (error) {
        console.error('Error:', error);
        showNotification('حدث خطأ: ' + error.message, 'error');
    }
};

window.rejectLeave = async function(id) {
    const reason = prompt('يرجى إدخال سبب الرفض (اختياري):');
    if (reason === null) return;

    try {
        const { error } = await sb
            .from('leaves')
            .update({ 
                status: 'rejected',
                admin_notes: reason,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        showNotification('تم رفض الإجازة', 'error');
        await loadLeaves();
        await loadStats();
    } catch (error) {
        console.error('Error:', error);
        showNotification('حدث خطأ: ' + error.message, 'error');
    }
};

// =============== نظام حساب الرواتب المحسّن ===============
async function loadSalaries() {
    const section = document.getElementById('salariesSection');
    section.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>جاري التحميل...</p></div>';

    try {
        const { data: salaries, error } = await sb
            .from('salary_calculations')
            .select(`*, users (full_name, email, department)`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!salaries || salaries.length === 0) {
            section.innerHTML = `
                <div class="table-wrapper">
                    <div class="table-header">
                        <h3>إدارة الرواتب</h3>
                        <button class="btn btn-success" onclick="window.adminFunctions.calculateMonthlySalaries()">
                            <i class="fas fa-calculator"></i> حساب رواتب الشهر
                        </button>
                    </div>
                    <div class="empty-state">
                        <i class="fas fa-money-bill-wave fa-2x"></i>
                        <p>لا يوجد سجلات رواتب</p>
                    </div>
                </div>`;
            return;
        }

        const currentMonth = new Date().toISOString().slice(0, 7);
        const currentMonthSalaries = salaries.filter(s => s.month === currentMonth);

        const totalAmount = currentMonthSalaries.reduce((sum, s) => sum + (s.final_salary || 0), 0);
        const paidCount = currentMonthSalaries.filter(s => s.payment_date).length;
        const pendingCount = currentMonthSalaries.filter(s => !s.payment_date).length;

        let html = `
            <div class="table-wrapper">
                <div class="table-header">
                    <h3>إدارة الرواتب</h3>
                    <div class="header-actions">
                        <button class="btn btn-success" onclick="window.adminFunctions.calculateMonthlySalaries()">
                            <i class="fas fa-calculator"></i> حساب رواتب الشهر
                        </button>
                    </div>
                </div>
                
                <div class="cards" style="margin: 1.5rem 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                    <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; border-radius: 10px;">
                        <h3 style="margin: 0 0 0.5rem 0;"><i class="fas fa-calculator"></i> إجمالي الرواتب هذا الشهر</h3>
                        <div class="value" style="font-size: 2rem; font-weight: bold;">${totalAmount.toFixed(2)} ج.م</div>
                    </div>
                    <div class="card" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 1.5rem; border-radius: 10px;">
                        <h3 style="margin: 0 0 0.5rem 0;"><i class="fas fa-check-circle"></i> الرواتب المدفوعة</h3>
                        <div class="value" style="font-size: 2rem; font-weight: bold;">${paidCount}</div>
                    </div>
                    <div class="card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 1.5rem; border-radius: 10px;">
                        <h3 style="margin: 0 0 0.5rem 0;"><i class="fas fa-clock"></i> الرواتب المعلقة</h3>
                        <div class="value" style="font-size: 2rem; font-weight: bold;">${pendingCount}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>الموظف</th>
                            <th>القسم</th>
                            <th>الشهر</th>
                            <th>الراتب الأساسي</th>
                            <th>أيام الحضور</th>
                            <th>أيام الغياب</th>
                            <th>إجمالي الخصومات</th>
                            <th>خصم التأخير</th>
                            <th>مكافأة إضافي</th>
                            <th>الصافي</th>
                            <th>الحالة</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>`;

        salaries.forEach(salary => {
            const isPaid = !!salary.payment_date;
            const statusClass = isPaid ? 'status-active' : 'status-pending';
            const statusText = isPaid ? 'مدفوع' : 'معلق';
            
            // حساب خصم الغياب من البيانات
            const dailySalary = (salary.base_salary || 0) / (salary.total_work_days || 30);
            const absenceDeduction = (salary.absent_days || 0) * dailySalary;
            const totalDeductions = (salary.leave_deductions || 0);

            html += `
                <tr>
                    <td>${salary.users?.full_name || salary.users?.email || '-'}</td>
                    <td>${salary.users?.department || '-'}</td>
                    <td>${salary.month || '-'}</td>
                    <td>${(salary.base_salary || 0).toFixed(2)} ج.م</td>
                    <td>${salary.actual_work_days || 0} يوم</td>
                    <td style="color: #dc3545; font-weight: bold;">${salary.absent_days || 0} يوم</td>
                    <td style="color: #dc3545;">${totalDeductions.toFixed(2)} ج.م</td>
                    <td style="color: #dc3545;">${(salary.late_deductions || 0).toFixed(2)} ج.م</td>
                    <td style="color: #28a745;">${(salary.overtime_bonus || 0).toFixed(2)} ج.م</td>
                    <td><strong style="color: #007bff; font-size: 1.1rem;">${(salary.final_salary || 0).toFixed(2)} ج.م</strong></td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                    <td>
                        <div class="action-buttons">
                            ${!isPaid ? `
                                <button class="btn btn-success" onclick="window.adminFunctions.markAsPaid('${salary.id}')">
                                    <i class="fas fa-check"></i>
                                </button>
                            ` : ''}
                            <button class="btn btn-danger" onclick="window.adminFunctions.deleteSalary('${salary.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        section.innerHTML = html;

    } catch (error) {
        console.error('Error loading salaries:', error);
        section.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle fa-2x"></i>
                <p>حدث خطأ في تحميل البيانات</p>
            </div>
        `;
    }
}

// دالة حساب الرواتب بنظام صحيح 100%
window.calculateMonthlySalaries = async function() {
    const month = prompt('أدخل الشهر (YYYY-MM):', new Date().toISOString().slice(0, 7));
    if (!month) return;

    try {
        showNotification('جاري حساب الرواتب...', 'info');

        // جلب الموظفين النشطين
        const { data: users, error: usersError } = await sb
            .from('users')
            .select('id, full_name, email, basic_salary, shift_type_id, hourly_rate')
            .eq('status', 'active')
            .eq('role', 'employee');

        if (usersError) throw usersError;

        if (!users || users.length === 0) {
            showNotification('لا يوجد موظفين نشطين', 'error');
            return;
        }

        let successCount = 0;
        const startDate = `${month}-01`;
        const endDate = new Date(month + '-01');
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);
        const endDateStr = endDate.toISOString().split('T')[0];
        
        // عدد أيام الشهر الفعلية
        const daysInMonth = endDate.getDate();

        for (const user of users) {
            // التحقق من وجود راتب مسبق
            const { data: existing } = await sb
                .from('salary_calculations')
                .select('id')
                .eq('user_id', user.id)
                .eq('month', month)
                .maybeSingle();

            if (existing) {
                console.log(`الراتب موجود مسبقاً للموظف: ${user.full_name}`);
                continue;
            }

            // جلب سجلات الحضور
            const { data: attendance } = await sb
                .from('attendance')
                .select('date, check_in, check_out, late_minutes, overtime_minutes')
                .eq('user_id', user.id)
                .gte('date', startDate)
                .lte('date', endDateStr);

            // حساب أيام الحضور والغياب
            const actualWorkDays = attendance?.length || 0;
            const absentDays = daysInMonth - actualWorkDays;

            // حساب إجمالي دقائق التأخير والإضافي
            let totalLateMinutes = 0;
            let totalOvertimeMinutes = 0;

            attendance?.forEach(record => {
                totalLateMinutes += record.late_minutes || 0;
                totalOvertimeMinutes += record.overtime_minutes || 0;
            });

            // جلب الإجازات غير المدفوعة
            const { data: leaves } = await sb
                .from('leaves')
                .select('start_date, end_date, type')
                .eq('user_id', user.id)
                .eq('status', 'approved')
                .eq('type', 'unpaid')
                .gte('start_date', startDate)
                .lte('end_date', endDateStr);

            let unpaidLeaveDays = 0;
            leaves?.forEach(leave => {
                const start = new Date(leave.start_date);
                const end = new Date(leave.end_date);
                const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                unpaidLeaveDays += days;
            });

            // ===== الحسابات =====
            const basicSalary = user.basic_salary || 0;
            
            // الأجر اليومي = الراتب الشهري ÷ عدد أيام الشهر
            const dailySalary = basicSalary / daysInMonth;
            
            // الأجر بالساعة = الأجر اليومي ÷ 8 ساعات
            const hourlySalary = user.hourly_rate || (dailySalary / 8);

            // 1. خصم الغياب = عدد أيام الغياب × الأجر اليومي
            const absenceDeductions = absentDays * dailySalary;

            // 2. خصم التأخير = (إجمالي دقائق التأخير ÷ 60) × الأجر بالساعة
            const lateDeductions = (totalLateMinutes / 60) * hourlySalary;

            // 3. مكافأة الإضافي = (إجمالي دقائق الإضافي ÷ 60) × الأجر بالساعة × 1.5
            const overtimeBonus = (totalOvertimeMinutes / 60) * hourlySalary * 1.5;

            // 4. خصم الإجازات بدون راتب = عدد أيام الإجازة × الأجر اليومي
            const leaveDeductions = unpaidLeaveDays * dailySalary;

            // 5. إجمالي الخصومات (الغياب + الإجازات)
            const totalLeaveDeductions = absenceDeductions + leaveDeductions;

            // 6. الراتب الصافي = الراتب الأساسي - خصم الغياب - خصم التأخير - خصم الإجازات + مكافأة الإضافي
            const finalSalary = basicSalary - totalLeaveDeductions - lateDeductions + overtimeBonus;

            // حفظ البيانات في قاعدة البيانات
            const { error: insertError } = await sb
                .from('salary_calculations')
                .insert({
                    user_id: user.id,
                    month: month,
                    base_salary: basicSalary,
                    shift_hours: 8,
                    total_work_days: daysInMonth,
                    actual_work_days: actualWorkDays,
                    absent_days: absentDays,
                    late_deductions: lateDeductions,
                    leave_deductions: totalLeaveDeductions,
                    overtime_bonus: overtimeBonus,
                    overtime_hours: (totalOvertimeMinutes / 60),
                    unpaid_leave_days: unpaidLeaveDays,
                    final_salary: finalSalary,
                    notes: `حضر: ${actualWorkDays} يوم | غاب: ${absentDays} يوم | تأخير: ${totalLateMinutes} دقيقة | إضافي: ${totalOvertimeMinutes} دقيقة | خصم غياب: ${absenceDeductions.toFixed(2)} ج.م`,
                    created_at: new Date().toISOString()
                });

            if (!insertError) {
                successCount++;
                console.log(`✅ تم حساب راتب: ${user.full_name} = ${finalSalary.toFixed(2)} ج.م`);
            } else {
                console.error(`❌ خطأ في حساب راتب: ${user.full_name}`, insertError);
            }
        }

        showNotification(`تم حساب ${successCount} راتب بنجاح`, 'success');
        await loadSalaries();
        
    } catch (error) {
        console.error('Error:', error);
        showNotification('حدث خطأ: ' + error.message, 'error');
    }
};

window.markAsPaid = async function(salaryId) {
    if (!confirm('هل أنت متأكد من تأكيد دفع هذا الراتب؟')) return;

    try {
        const { error } = await sb
            .from('salary_calculations')
            .update({ payment_date: new Date().toISOString() })
            .eq('id', salaryId);

        if (error) throw error;

        showNotification('تم تأكيد دفع الراتب بنجاح', 'success');
        await loadSalaries();
    } catch (error) {
        console.error('Error:', error);
        showNotification('حدث خطأ', 'error');
    }
};

window.deleteSalary = async function(salaryId) {
    if (!confirm('هل أنت متأكد من حذف هذا الراتب؟')) return;

    try {
        const { error } = await sb
            .from('salary_calculations')
            .delete()
            .eq('id', salaryId);

        if (error) throw error;

        showNotification('تم حذف الراتب بنجاح', 'success');
        await loadSalaries();
    } catch (error) {
        console.error('Error:', error);
        showNotification('حدث خطأ', 'error');
    }
};

// =============== إدارة الإعدادات ===============
async function loadSettings() {
    const section = document.getElementById('settingsSection');
    section.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>جاري التحميل...</p></div>';

    try {
        const { data: departments } = await sb.from('departments').select('*');
        const { data: positions } = await sb.from("positions").select("*");
        const { data: workShifts } = await sb.from("work_shifts").select("*");

        let html = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;">
                
                <!-- إدارة الأقسام -->
                <div style="background: #f8f9fa; padding: 1rem; border-radius: 10px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                        <h4><i class="fas fa-building"></i> الأقسام</h4>
                        <button class="btn btn-primary btn-sm" onclick="window.adminFunctions.addDepartment()">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <table style="width: 100%;">
                        <thead><tr><th>الاسم</th><th>الإجراءات</th></tr></thead>
                        <tbody>`;

        departments?.forEach(d => {
            html += `
                <tr>
                    <td>${d.name}</td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="window.adminFunctions.editDepartment(${d.id}, '${d.name.replace(/'/g, "\\'")}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="window.adminFunctions.deleteDepartment(${d.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div>
                
                <!-- إدارة المسميات -->
                <div style="background: #f8f9fa; padding: 1rem; border-radius: 10px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                        <h4><i class="fas fa-id-badge"></i> المسميات</h4>
                        <button class="btn btn-primary btn-sm" onclick="window.adminFunctions.addPosition()">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <table style="width: 100%;">
                        <thead><tr><th>الاسم</th><th>الإجراءات</th></tr></thead>
                        <tbody>`;

        positions?.forEach(p => {
            html += `
                <tr>
                    <td>${p.name}</td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="window.adminFunctions.editPosition(${p.id}, '${p.name.replace(/'/g, "\\'")}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="window.adminFunctions.deletePosition(${p.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div>
                
                <!-- إدارة فترات العمل -->
                <div style="background: #f8f9fa; padding: 1rem; border-radius: 10px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                        <h4><i class="fas fa-clock"></i> فترات العمل</h4>
                        <button class="btn btn-primary btn-sm" onclick="window.adminFunctions.addWorkShift()">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <table style="width: 100%;">
                        <thead><tr><th>الاسم</th><th>الساعات</th><th>الإجراءات</th></tr></thead>
                        <tbody>`;

        workShifts?.forEach(s => {
            html += `
                <tr>
                    <td>${s.name}</td>
                    <td>${s.hours_per_day} ساعة</td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="window.adminFunctions.editWorkShift(${s.id}, '${s.name.replace(/'/g, "\\'")}', ${s.hours_per_day})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="window.adminFunctions.deleteWorkShift(${s.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
        });

        html += '</tbody></table></div></div>';
        section.innerHTML = html;
    } catch (error) {
        console.error('Error:', error);
        section.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle fa-2x"></i><p>حدث خطأ</p></div>';
    }
}

window.addDepartment = async function() {
    const name = prompt("اسم القسم:");
    if (!name) return;
    
    try {
        await sb.from('departments').insert([{ name }]);
        showNotification('تم إضافة القسم بنجاح', 'success');
        loadSettings();
    } catch (err) {
        showNotification("خطأ: " + err.message, 'error');
    }
};

window.editDepartment = async function(id, oldName) {
    const name = prompt("اسم القسم:", oldName);
    if (!name) return;
    
    try {
        await sb.from('departments').update({ name }).eq('id', id);
        showNotification('تم تعديل القسم بنجاح', 'success');
        loadSettings();
    } catch (err) {
        showNotification("خطأ: " + err.message, 'error');
    }
};

window.deleteDepartment = async function(id) {
    if (!confirm("هل أنت متأكد من حذف هذا القسم؟")) return;
    
    try {
        await sb.from('departments').delete().eq('id', id);
        showNotification('تم حذف القسم بنجاح', 'success');
        loadSettings();
    } catch (err) {
        showNotification("خطأ: " + err.message, 'error');
    }
};

window.addPosition = async function() {
    const name = prompt("اسم المسمى الوظيفي:");
    if (!name) return;
    
    try {
        await sb.from('positions').insert([{ name }]);
        showNotification('تم إضافة المسمى بنجاح', 'success');
        loadSettings();
    } catch (err) {
        showNotification("خطأ: " + err.message, 'error');
    }
};

window.editPosition = async function(id, oldName) {
    const name = prompt("اسم المسمى الوظيفي:", oldName);
    if (!name) return;
    
    try {
        await sb.from('positions').update({ name }).eq('id', id);
        showNotification('تم تعديل المسمى بنجاح', 'success');
        loadSettings();
    } catch (err) {
        showNotification("خطأ: " + err.message, 'error');
    }
};

window.deletePosition = async function(id) {
    if (!confirm("هل أنت متأكد من حذف هذا المسمى؟")) return;
    
    try {
        await sb.from('positions').delete().eq('id', id);
        showNotification('تم حذف المسمى بنجاح', 'success');
        loadSettings();
    } catch (err) {
        showNotification("خطأ: " + err.message, 'error');
    }
};

window.addWorkShift = async function() {
    const name = prompt("اسم فترة العمل:");
    if (!name) return;
    
    const hours = prompt("عدد الساعات اليومية:");
    if (!hours || isNaN(hours)) {
        showNotification("يرجى إدخال عدد ساعات صحيح", 'error');
        return;
    }
    
    const startTime = prompt("وقت البدء (HH:MM):");
    const endTime = prompt("وقت الانتهاء (HH:MM):");
    
    try {
        await sb.from('work_shifts').insert([{
            name,
            hours_per_day: parseInt(hours),
            start_time: startTime,
            end_time: endTime
        }]);
        showNotification('تم إضافة فترة العمل بنجاح', 'success');
        loadSettings();
    } catch (err) {
        showNotification("خطأ: " + err.message, 'error');
    }
};

window.editWorkShift = async function(id, oldName, oldHours) {
    const name = prompt("اسم فترة العمل:", oldName);
    if (!name) return;
    
    const hours = prompt("عدد الساعات اليومية:", oldHours);
    if (!hours || isNaN(hours)) {
        showNotification("يرجى إدخال عدد ساعات صحيح", 'error');
        return;
    }
    
    try {
        await sb.from('work_shifts').update({
            name,
            hours_per_day: parseInt(hours)
        }).eq('id', id);
        showNotification('تم تعديل فترة العمل بنجاح', 'success');
        loadSettings();
    } catch (err) {
        showNotification("خطأ: " + err.message, 'error');
    }
};

window.deleteWorkShift = async function(id) {
    if (!confirm("هل أنت متأكد من حذف هذه فترة العمل؟")) return;
    
    try {
        await sb.from('work_shifts').delete().eq('id', id);
        showNotification('تم حذف فترة العمل بنجاح', 'success');
        loadSettings();
    } catch (err) {
        showNotification("خطأ: " + err.message, 'error');
    }
};

// =============== التبديل بين الأقسام ===============
window.switchTab = function(tab, event) {
    document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
    if (event?.target) event.target.classList.add('active');

    ['employees','attendance','leaves','salaries','settings'].forEach(s => {
        const section = document.getElementById(`${s}Section`);
        if (section) section.style.display = (s === tab ? 'block' : 'none');
    });

    if (tab === 'employees') loadUsers();
    if (tab === 'attendance') loadAttendance();
    if (tab === 'leaves') loadLeaves();
    if (tab === 'salaries') loadSalaries();
    if (tab === 'settings') loadSettings();
};

// =============== تسجيل الخروج ===============
window.logout = async function() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        try {
            await sb.auth.signOut();
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Error:', error);
            showNotification('حدث خطأ أثناء تسجيل الخروج', 'error');
        }
    }
};

// =============== تصدير الدوال للاستخدام العام ===============
window.adminFunctions = {
    loadUsers,
    loadAttendance,
    loadLeaves,
    loadSalaries,
    loadSettings,
    openAddEmployeeModal,
    viewEmployee,
    editEmployee,
    deleteEmployee,
    approveLeave,
    rejectLeave,
    calculateMonthlySalaries,
    markAsPaid,
    deleteSalary,
    addDepartment,
    editDepartment,
    deleteDepartment,
    addPosition,
    editPosition,
    deletePosition,
    addWorkShift,
    editWorkShift,
    deleteWorkShift
};

// =============== التهيئة عند تحميل الصفحة ===============
document.addEventListener('DOMContentLoaded', async () => {
    const session = await checkAdminSession();
    if (session) {
        await loadStats();
        await loadUsers();
    }
});