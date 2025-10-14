
// Export the loadUsers function for use in other modules
export { loadUsers };

// Import the shared Supabase client and utilities
import { sb, showNotification, loadStats } from './supabase-config.js';

// Global variables
let currentEditingId = null;

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// تحميل الموظفين
async function loadUsers(page = 1, limit = 20) {
    const section = document.getElementById('employeesSection');
    section.innerHTML = `
        <div class="table-wrapper">
            <div class="table-header">
                <h3>قائمة الموظفين</h3>
                <button class="btn btn-primary" onclick="openAddEmployeeModal()">
                    <i class="fas fa-plus"></i> إضافة موظف
                </button>
            </div>
            <div class="search-bar">
                <input type="text" id="userSearch" placeholder="البحث عن موظف..." oninput="debounceSearch()">
                <select id="departmentFilter" onchange="searchUsers()">
                    <option value="">كل الأقسام</option>
                    <option value="IT">تقنية المعلومات</option>
                    <option value="HR">الموارد البشرية</option>
                    <option value="Finance">المالية</option>
                    <option value="Sales">المبيعات</option>
                    <option value="Marketing">التسويق</option>
                </select>
                <select id="statusFilter" onchange="searchUsers()">
                    <option value="">كل الحالات</option>
                    <option value="active">نشط</option>
                    <option value="inactive">غير نشط</option>
                </select>
                <button class="btn btn-primary" onclick="searchUsers()">
                    <i class="fas fa-search"></i> بحث
                </button>
            </div>
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>جاري تحميل البيانات...</p>
            </div>
        </div>
    `;

    try {
        let query = sb.from('users')
            .select(`
                id,
                full_name,
                email,
                department,
                position,
                status,
                role,
                photo_url,
                work_shifts(name)
            `)
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

        const searchTerm = document.getElementById('userSearch')?.value;
        const department = document.getElementById('departmentFilter')?.value;
        const status = document.getElementById('statusFilter')?.value;

        if (searchTerm) {
            query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }
        if (department) {
            query = query.eq('department', department);
        }
        if (status) {
            query = query.eq('status', status);
        }

        const { data: users, error, count } = await query;

        if (error) throw error;

        if (!users || users.length === 0) {
            section.innerHTML = `
                <div class="table-wrapper">
                    <div class="table-header">
                        <h3>قائمة الموظفين</h3>
                        <button class="btn btn-primary" onclick="openAddEmployeeModal()">
                            <i class="fas fa-plus"></i> إضافة موظف
                        </button>
                    </div>
                    <div class="empty-state">
                        <i class="fas fa-users fa-2x"></i>
                        <p>لا يوجد موظفين</p>
                        <button class="btn btn-primary" onclick="openAddEmployeeModal()">
                            <i class="fas fa-plus"></i> إضافة موظف
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        updateUsersTable(users, count || users.length);
    } catch (error) {
        console.error('Error loading users:', error);
        section.innerHTML = `
            <div class="table-wrapper">
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle fa-2x"></i>
                    <p>حدث خطأ أثناء تحميل البيانات</p>
                    <button class="btn btn-primary" onclick="loadUsers()">
                        <i class="fas fa-sync"></i> إعادة المحاولة
                    </button>
                </div>
            </div>
        `;
        showNotification('حدث خطأ أثناء تحميل بيانات الموظفين', 'error');
    }
}

// تحديث جدول الموظفين مع الصور
function updateUsersTable(users, totalCount) {
    const section = document.getElementById('employeesSection');
    
    if (!users || users.length === 0) {
        section.innerHTML = `
            <div class="table-wrapper">
                <div class="empty-state">
                    <i class="fas fa-users fa-2x"></i>
                    <p>لا يوجد موظفين</p>
                </div>
            </div>
        `;
        return;
    }

    let html = `
        <div class="table-wrapper">
            <div class="table-header">
                <h3>قائمة الموظفين (إجمالي: ${totalCount})</h3>
                <button class="btn btn-primary" onclick="openAddEmployeeModal()">
                    <i class="fas fa-plus"></i> إضافة موظف
                </button>
            </div>
            <div class="search-bar">
                <input type="text" id="userSearch" placeholder="البحث عن موظف..." oninput="debounceSearch()">
                <select id="departmentFilter" onchange="searchUsers()">
                    <option value="">كل الأقسام</option>
                    <option value="IT">تقنية المعلومات</option>
                    <option value="HR">الموارد البشرية</option>
                    <option value="Finance">المالية</option>
                    <option value="Sales">المبيعات</option>
                    <option value="Marketing">التسويق</option>
                </select>
                <select id="statusFilter" onchange="searchUsers()">
                    <option value="">كل الحالات</option>
                    <option value="active">نشط</option>
                    <option value="inactive">غير نشط</option>
                </select>
                <button class="btn btn-primary" onclick="searchUsers()">
                    <i class="fas fa-search"></i> بحث
                </button>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>الاسم</th>
                        <th>البريد الإلكتروني</th>
                        <th>القسم</th>
                        <th>المسمى الوظيفي</th>
                        <th>نوع الشيفت</th>
                        <th>الدور</th>
                        <th>الحالة</th>
                        <th>الإجراءات</th>
                    </tr>
                </thead>
                <tbody id="usersTableBody">
    `;

users.forEach(user => {
    const statusClass = user.status === 'active' ? 'status-active' : 'status-inactive';
    const statusText = user.status === 'active' ? 'نشط' : 'غير نشط';

    // نفس المنطق المستخدم في تفاصيل الموظف
    const photoUrl = user.photo_url || 'default-avatar.png.jpg'; 

    html += `
        <tr>
            <td style="display: flex; align-items: center;">
                <div style="width: 60px; height: 60px; border-radius: 50%; overflow: hidden; margin-left: 1rem;">
                    <img src="${photoUrl}" alt="صورة الموظف" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                ${user.full_name || '-'}
            </td>
            <td>${user.email}</td>
            <td>${user.department || '-'}</td>
            <td>${user.position || '-'}</td>
            <td>${user.work_shifts?.name || 'غير محدد'}</td>
            <td>${user.role === 'admin' ? 'مدير' : 'موظف'}</td>
            <td><span class="status ${statusClass}">${statusText}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-primary" onclick="viewEmployee('${user.id}')" title="عرض">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-warning" onclick="editEmployee('${user.id}')" title="تعديل">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${user.role !== 'admin' ? `
                        <button class="btn btn-danger" onclick="deleteEmployee('${user.id}')" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `;
});

    html += '</tbody></table></div>';
    section.innerHTML = html;
}

// دالة البحث عن الموظفين
window.searchUsers = async function() {
    const searchTerm = document.getElementById('userSearch')?.value || '';
    const department = document.getElementById('departmentFilter')?.value || '';
    const status = document.getElementById('statusFilter')?.value || '';

    try {
        let query = sb.from('users')
            .select('id, full_name, email, department, position, status, role, work_shifts(name)', { count: 'exact' })
            .order('created_at', { ascending: false });

        if (searchTerm) {
            query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }
        if (department) {
            query = query.eq('department', department);
        }
        if (status) {
            query = query.eq('status', status);
        }

        const { data: users, error, count } = await query;

        if (error) throw error;

        updateUsersTable(users, count);
    } catch (error) {
        console.error('Error searching users:', error);
        showNotification('حدث خطأ أثناء البحث', 'error');
    }
};

window.debounceSearch = debounce(() => searchUsers(), 300);

window.openEmployeeModal = async function(editing = false, employeeData = null) {
  const modal = document.getElementById('employeeModal');
  const title = document.getElementById('employeeModalTitle');
  const form = document.getElementById('employeeForm');

  title.innerHTML = editing
    ? `<i class="fas fa-user-edit"></i> تعديل بيانات الموظف`
    : `<i class="fas fa-user-plus"></i> إضافة موظف جديد`;

  modal.style.display = 'flex';

  await loadDepartments(); // تحميل الأقسام
  await loadShifts(); // تحميل أنواع الشيفت

  if (editing && employeeData) {
    document.getElementById('empEmail').value = employeeData.email || '';
    document.getElementById('empName').value = employeeData.name || '';
    document.getElementById('empPhone').value = employeeData.phone || '';
    document.getElementById('empDepartment').value = employeeData.department || '';
    document.getElementById('empPosition').value = employeeData.position || '';
    document.getElementById('empShift').value = employeeData.shift || '';
    document.getElementById('empSalary').value = employeeData.salary || '';
    document.getElementById('empStatus').value = employeeData.status || 'active';
  } else {
    form.reset();
  }
};


window.loadShifts = async function () {
  const shiftSelect = document.getElementById("empShift");
  if (!shiftSelect) return;

  shiftSelect.innerHTML = `<option value="">جاري التحميل...</option>`;

  const { data, error } = await sb.from("shifts").select("id, name");
  if (error) {
    console.error("خطأ في تحميل الشيفتات:", error);
    shiftSelect.innerHTML = `<option value="">فشل التحميل</option>`;
    return;
  }

  shiftSelect.innerHTML = `<option value="">اختر نوع الشيفت</option>`;
  data.forEach(s => {
    shiftSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });
};




// معاينة صورة الموظف
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

// تحميل الشيفتات من جدول work_shifts
async function loadShiftOptions() {
    const shiftSelect = document.getElementById('empShift');
    if (!shiftSelect) return;

    try {
        const { data: shifts, error } = await sb.from('work_shifts').select('id, name, hours_per_day');
        
        if (error) throw error;

        shiftSelect.innerHTML = '<option value="">اختر الشيفت</option>';
        
        shifts?.forEach(shift => {
            shiftSelect.innerHTML += `
                <option value="${shift.id}">
                    ${shift.name} - ${shift.hours_per_day} ساعات
                </option>
            `;
        });
    } catch (error) {
        console.error('Error loading shifts:', error);
        shiftSelect.innerHTML = '<option value="">خطأ في تحميل الشيفتات</option>';
    }
}

// فتح نافذة إضافة موظف
window.openAddEmployeeModal = async function() {
    currentEditingId = null;
    document.getElementById('employeeModalTitle').innerHTML = '<i class="fas fa-user-plus"></i> إضافة موظف جديد';
    document.getElementById('employeeForm').reset();
    document.getElementById('empPassword').disabled = false;
    document.getElementById('empPassword').required = true;
    document.getElementById('employeeMessage').style.display = 'none';
    
    // إخفاء معاينة الصورة
    const photoPreview = document.getElementById('empPhotoPreview');
    if (photoPreview) {
        photoPreview.style.display = 'none';
        photoPreview.src = '';
    }
    
    document.getElementById('employeeModal').classList.add('show');
    
    await loadShiftOptions();
}

// عرض تفاصيل موظف
window.viewEmployee = async function(id) {
    try {
        const { data: user, error } = await sb.from('users')
            .select('*, work_shifts(name)')
            .eq('id', id)
            .single();
        
        if (error) throw error;

        const photoUrl = user.photo_url || 'default-avatar.png.jpg'; // صورة افتراضية لو ما فيش صورة

        const details = `
            <div style="padding: 1rem;">
                <div style="display: flex; align-items: center; margin-bottom: 1.5rem;">
                    <div style="width: 80px; height: 80px; border-radius: 50%; overflow: hidden; margin-left: 1rem;">
                        <img src="${photoUrl}" alt="صورة الموظف" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div>
                        <h3 style="margin: 0 0 0.5rem 0;">${user.full_name || user.email}</h3>
                        <p style="color: #6c757d; margin: 0;">${user.position || 'غير محدد'} - ${user.department || 'غير محدد'}</p>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                    <div>
                        <p><strong>الاسم:</strong> ${user.full_name || '-'}</p>
                        <p><strong>البريد الإلكتروني:</strong> ${user.email}</p>
                        <p><strong>رقم الهاتف:</strong> ${user.phone || '-'}</p>
                        <p><strong>القسم:</strong> ${user.department || '-'}</p>
                    </div>
                    <div>
                        <p><strong>المسمى الوظيفي:</strong> ${user.position || '-'}</p>
                        <p><strong>نوع الشيفت:</strong> ${user.work_shifts?.name || 'غير محدد'}</p>
                        <p><strong>الراتب الأساسي:</strong> ${user.basic_salary ? user.basic_salary + ' ج.م' : '-'}</p>
                        <p><strong>الدور:</strong> ${user.role === 'admin' ? 'مدير' : 'موظف'}</p>
                        <p><strong>الحالة:</strong> ${user.status === 'active' ? 'نشط' : 'غير نشط'}</p>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('employeeDetails').innerHTML = details;
        document.getElementById('viewEmployeeModal').classList.add('show');
    } catch (error) {
        console.error('Error loading employee details:', error);
        showNotification('حدث خطأ أثناء تحميل تفاصيل الموظف', 'error');
    }
}

// تحميل الأقسام والمسميات (غير مرتبطة ببعض)
window.loadDepartments = async function() {
    const depSelect = document.getElementById("empDepartment");
    const posSelect = document.getElementById("empPosition");

    if (!depSelect || !posSelect) return;

    // تحميل الأقسام
    depSelect.innerHTML = `<option value="">جاري التحميل...</option>`;
    const { data: deps, error: depError } = await sb.from("departments").select("id, name");
    if (depError) {
        console.error("خطأ في تحميل الأقسام:", depError);
        depSelect.innerHTML = `<option value="">فشل التحميل</option>`;
    } else {
        depSelect.innerHTML = `<option value="">اختر القسم</option>`;
        deps.forEach(dep => {
            depSelect.innerHTML += `<option value="${dep.name}">${dep.name}</option>`;
        });
    }

    // تحميل المسميات
    posSelect.innerHTML = `<option value="">جاري التحميل...</option>`;
    const { data: positions, error: posError } = await sb.from("positions").select("id, name");
    if (posError) {
        console.error("خطأ في تحميل المسميات:", posError);
        posSelect.innerHTML = `<option value="">فشل التحميل</option>`;
    } else {
        posSelect.innerHTML = `<option value="">اختر المسمى الوظيفي</option>`;
        positions.forEach(pos => {
            posSelect.innerHTML += `<option value="${pos.name}">${pos.name}</option>`;
        });
    }
};

// تعديل موظف
window.editEmployee = async function(id) {
    try {
        const { data: user, error } = await sb
            .from('users')
            .select('*, work_shifts(id, name)')
            .eq('id', id)
            .single();

        if (error) throw error;

        currentEditingId = id;
        document.getElementById('employeeModalTitle').innerHTML = '<i class="fas fa-user-edit"></i> تعديل بيانات الموظف';
        document.getElementById('employeeForm').reset();

        // تحميل الأقسام والمسميات
        await loadDepartments();
        await loadShiftOptions();

        // تعبئة القيم بعد التحميل
        document.getElementById('empEmail').value = user.email || '';
        document.getElementById('empName').value = user.full_name || '';
        document.getElementById('empPhone').value = user.phone || '';
        document.getElementById('empDepartment').value = user.department || '';
        document.getElementById('empPosition').value = user.position || '';
        document.getElementById('empShift').value = user.shift_type_id || '';
        document.getElementById('empSalary').value = user.basic_salary || '';
        document.getElementById('empStatus').value = user.status || 'active';
        document.getElementById('empPassword').value = '';
        document.getElementById('empPassword').disabled = false;
        document.getElementById('empPassword').required = false;
        document.getElementById('employeeMessage').style.display = 'none';
        document.getElementById('employeeModal').classList.add('show');

    } catch (error) {
        console.error('Error loading employee for edit:', error);
        showNotification('حدث خطأ أثناء تحميل بيانات الموظف', 'error');
    }
};

// حذف موظف
window.deleteEmployee = async function(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الموظف؟ سيتم حذف جميع البيانات المرتبطة به.')) {
        return;
    }

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
        console.error('Error deleting employee:', error);
        showNotification('حدث خطأ أثناء حذف الموظف: ' + error.message, 'error');
    }
}

// معالجة نموذج الموظف
document.getElementById('employeeForm').addEventListener('submit', async function(e) {
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

    // التحقق من الرقم القومي
    if (nationalId && nationalId.length !== 14) {
        messageDiv.className = 'message error';
        messageDiv.textContent = 'الرقم القومي يجب أن يكون 14 رقماً';
        messageDiv.style.display = 'block';
        return;
    }

    try {
        let photoUrl = null;
        
        // رفع الصورة إلى Supabase Storage
        if (photoFile) {
            const fileExt = photoFile.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `employee_photos/${fileName}`;

            const { data: uploadData, error: uploadError } = await sb.storage
                .from('employee-files')
                .upload(filePath, photoFile);

            if (uploadError) {
                console.error('Error uploading photo:', uploadError);
            } else {
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

            if (photoUrl) {
                updateData.photo_url = photoUrl;
            }

            const { error } = await sb.from('users').update(updateData).eq('id', currentEditingId);
            if (error) throw error;

            messageDiv.className = 'message success';
            messageDiv.textContent = 'تم تحديث بيانات الموظف بنجاح';
            messageDiv.style.display = 'block';

            setTimeout(() => {
                closeEmployeeModal();
                loadUsers();
                loadStats();
                showNotification('تم تحديث بيانات الموظف بنجاح', 'success');
            }, 2000);

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
                options: {
                    data: { role: "employee" }
                }
            });

            if (authError) throw authError;

            const userId = authData.user?.id;
            if (!userId) throw new Error('فشل الحصول على معرف المستخدم من Auth');

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

            if (photoUrl) {
                insertData.photo_url = photoUrl;
            }

            const { error: insertError } = await sb.from('users').insert([insertData]);

            if (insertError) throw insertError;

            messageDiv.className = 'message success';
            messageDiv.textContent = 'تم إضافة الموظف بنجاح';
            messageDiv.style.display = 'block';

            setTimeout(() => {
                closeEmployeeModal();
                loadUsers();
                loadStats();
                showNotification('تم إضافة الموظف بنجاح', 'success');
            }, 2000);
        }
    } catch (error) {
        console.error('Error in employee form:', error);
        messageDiv.className = 'message error';
        messageDiv.textContent = 'حدث خطأ: ' + error.message;
        messageDiv.style.display = 'block';
    }
});

// إغلاق نافذة الموظف
window.closeEmployeeModal = function() {
    document.getElementById('employeeModal').classList.remove('show');
    document.getElementById('employeeForm').reset();
    currentEditingId = null;
}

// إغلاق نافذة عرض التفاصيل
window.closeViewEmployeeModal = function() {
    document.getElementById('viewEmployeeModal').classList.remove('show');
}

