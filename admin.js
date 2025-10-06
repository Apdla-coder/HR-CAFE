const { createClient } = supabase;
const supabaseUrl = "https://nxhnivykhlnauewpmuqv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54aG5pdnlraGxuYXVld3BtdXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4Mjk2NTYsImV4cCI6MjA3NDQwNTY1Nn0.-3ps3Mp7aYuA2m54sW3gNN3CpZ2acRtKGj8jI5eHTOU";
const sb = createClient(supabaseUrl, supabaseKey);

// تخزين مؤقت للبيانات
const cache = {
    departments: [],
    shifts: []
};

let currentEditingId = null;

// دالة debounce
function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// دالة لعرض الإشعارات
function showNotification(text, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    notificationText.textContent = text;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// فحص صلاحية المدير
async function checkAdminSession() {
    const { data: { session }, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !session) {
        window.location.href = '/index.html';
        return null;
    }

    const { data: userData, error } = await sb.from('users').select('*').eq('id', session.user.id).single();

    if (error || !userData || userData.role !== 'admin') {
        await sb.auth.signOut();
        window.location.href = '/index.html';
        return null;
    }

    document.getElementById('adminName').textContent = userData.full_name || userData.email;
    return session;
}

// تحديث الذاكرة المؤقتة
async function updateCache() {
    try {
        const [departments, shifts] = await Promise.all([
            sb.from('departments').select('*'),
            sb.from('work_shifts').select('*')
        ]);

        if (departments.data && !departments.error) {
            cache.departments = departments.data;
        }
        if (shifts.data && !shifts.error) {
            cache.shifts = shifts.data;
        }
    } catch (error) {
        console.error('Error updating cache:', error);
    }
}

// تحميل الإحصائيات
async function loadStats() {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const [usersResult, leavesResult, attendanceResult] = await Promise.all([
            sb.from('users').select('id, status', { count: 'exact' }),
            sb.from('leaves').select('id', { count: 'exact' }).eq('status', 'pending'),
            sb.from('attendance').select('id', { count: 'exact' }).eq('date', today)
        ]);

        if (usersResult.error) throw usersResult.error;
        if (leavesResult.error) throw leavesResult.error;
        if (attendanceResult.error) throw attendanceResult.error;

        const totalEmployees = usersResult.data?.length || 0;
        const activeEmployees = usersResult.data?.filter(u => u.status === 'active').length || 0;
        
        document.getElementById('totalEmployees').textContent = totalEmployees;
        document.getElementById('activeEmployees').textContent = activeEmployees;
        document.getElementById('pendingLeaves').textContent = leavesResult.data?.length || 0;
        document.getElementById('todayAttendance').textContent = attendanceResult.data?.length || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
        showNotification('حدث خطأ أثناء تحميل الإحصائيات', 'error');
    }
}

// التبديل بين الأقسام
window.switchTab = function(tab, event) {
    // إزالة التفعيل من كل التبويبات
    document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
    
    // تفعيل الزر اللي اتضغط عليه
    if (event && event.target) {
        event.target.classList.add('active');
    }

    // عرض القسم المطلوب وإخفاء الباقي
    ['employees','attendance','leaves','salaries','reports','settings'].forEach(s => {
        const section = document.getElementById(`${s}Section`);
        if (section) section.style.display = (s === tab ? 'block' : 'none');
    });

    // تحميل البيانات حسب التبويب
    if (tab === 'employees') loadUsers();
    if (tab === 'attendance') loadAttendance();
    if (tab === 'leaves') loadLeaves();
    if (tab === 'salaries') loadSalaries();
    if (tab === 'reports') loadReports();
    if (tab === 'settings') loadDepartmentsSettings();
};


// تحميل بيانات الرواتب
async function loadSalaries() {
    const section = document.getElementById('salariesSection');
    section.innerHTML = `
        <div class="table-wrapper">
            <div class="table-header">
                <h3>إدارة المرتبات والرواتب</h3>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="showDailySalaries()">
                        <i class="fas fa-calendar-day"></i> الحسابات اليومية
                    </button>
                    <button class="btn btn-success" onclick="calculateMonthlySalaries()">
                        <i class="fas fa-calculator"></i> حساب رواتب الشهر
                    </button>
                    <button class="btn btn-warning" onclick="exportSalariesToCSV()">
                        <i class="fas fa-file-export"></i> تصدير Excel
                    </button>
                </div>
            </div>
            
            <div class="search-bar">
                <input type="text" id="salarySearch" placeholder="البحث عن موظف..." oninput="searchSalaries()">
                <input type="month" id="salaryMonth" onchange="searchSalaries()">
                <select id="salaryStatusFilter" onchange="searchSalaries()">
                    <option value="">جميع الحالات</option>
                    <option value="pending">معلق</option>
                    <option value="paid">مدفوع</option>
                </select>
                <button class="btn btn-primary" onclick="searchSalaries()">
                    <i class="fas fa-search"></i> بحث
                </button>
            </div>

            <div class="cards" style="margin: 1.5rem 0;">
                <div class="card">
                    <h3><i class="fas fa-calculator"></i> إجمالي الرواتب هذا الشهر</h3>
                    <div class="value" id="totalSalariesAmount">0 ج.م</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-check-circle"></i> الرواتب المدفوعة</h3>
                    <div class="value" id="paidSalariesCount">0</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-clock"></i> الرواتب المعلقة</h3>
                    <div class="value" id="pendingSalariesCount">0</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-exclamation-triangle"></i> إجمالي الخصومات</h3>
                    <div class="value" id="totalDeductionsAmount">0 ج.م</div>
                </div>
            </div>

            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>جاري تحميل البيانات...</p>
            </div>
        </div>
    `;

    try {
        const { data: salaries, error } = await sb
            .from('salary_calculations')
            .select('*, users(full_name, email, department, position)')
            .order('month', { ascending: false });

        if (error) throw error;

        const currentMonth = new Date().toISOString().slice(0, 7);
        const currentMonthSalaries = salaries?.filter(s => s.month === currentMonth) || [];
        
        const totalAmount = currentMonthSalaries.reduce((sum, s) => sum + (s.final_salary || 0), 0);
        const paidCount = currentMonthSalaries.filter(s => s.payment_date).length;
        const pendingCount = currentMonthSalaries.filter(s => !s.payment_date).length;
        const totalDeductions = currentMonthSalaries.reduce((sum, s) => 
            sum + (s.late_deductions || 0) + (s.leave_deductions || 0), 0
        );

        document.getElementById('totalSalariesAmount').textContent = totalAmount.toFixed(2) + ' ج.م';
        document.getElementById('paidSalariesCount').textContent = paidCount;
        document.getElementById('pendingSalariesCount').textContent = pendingCount;
        document.getElementById('totalDeductionsAmount').textContent = totalDeductions.toFixed(2) + ' ج.م';

        if (!salaries || salaries.length === 0) {
            section.innerHTML = `
                <div class="table-wrapper">
                    <div class="table-header">
                        <h3>إدارة المرتبات والرواتب</h3>
                        <button class="btn btn-success" onclick="calculateMonthlySalaries()">
                            <i class="fas fa-calculator"></i> حساب رواتب الشهر
                        </button>
                    </div>
                    <div class="empty-state">
                        <i class="fas fa-money-bill-wave fa-2x"></i>
                        <p>لا يوجد سجلات رواتب</p>
                        <p style="font-size: 0.9rem; color: #6c757d; margin-top: 0.5rem;">
                            اضغط على "حساب رواتب الشهر" لبدء حساب الرواتب تلقائياً
                        </p>
                    </div>
                </div>
            `;
            return;
        }

        let html = `
            <div class="table-wrapper">
                <div class="table-header">
                    <h3>إدارة المرتبات والرواتب</h3>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-success" onclick="calculateMonthlySalaries()">
                            <i class="fas fa-calculator"></i> حساب رواتب الشهر
                        </button>
                        <button class="btn btn-warning" onclick="exportSalariesToCSV()">
                            <i class="fas fa-file-export"></i> تصدير Excel
                        </button>
                    </div>
                </div>
                
                <div class="search-bar">
                    <input type="text" id="salarySearch" placeholder="البحث عن موظف..." oninput="searchSalaries()">
                    <input type="month" id="salaryMonth" onchange="searchSalaries()">
                    <select id="salaryStatusFilter" onchange="searchSalaries()">
                        <option value="">جميع الحالات</option>
                        <option value="pending">معلق</option>
                        <option value="paid">مدفوع</option>
                    </select>
                    <button class="btn btn-primary" onclick="searchSalaries()">
                        <i class="fas fa-search"></i> بحث
                    </button>
                </div>

                <div class="cards" style="margin: 1.5rem 0;">
                    <div class="card">
                        <h3><i class="fas fa-calculator"></i> إجمالي الرواتب هذا الشهر</h3>
                        <div class="value">${totalAmount.toFixed(2)} ج.م</div>
                    </div>
                    <div class="card">
                        <h3><i class="fas fa-check-circle"></i> الرواتب المدفوعة</h3>
                        <div class="value">${paidCount}</div>
                    </div>
                    <div class="card">
                        <h3><i class="fas fa-clock"></i> الرواتب المعلقة</h3>
                        <div class="value">${pendingCount}</div>
                    </div>
                    <div class="card">
                        <h3><i class="fas fa-exclamation-triangle"></i> إجمالي الخصومات</h3>
                        <div class="value">${totalDeductions.toFixed(2)} ج.م</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>الموظف</th>
                            <th>القسم</th>
                            <th>الشهر</th>
                            <th>الأساسي</th>
                            <th>ساعات العمل</th>
                            <th>الإضافي</th>
                            <th>خصم التأخير</th>
                            <th>خصم الإجازات</th>
                            <th>الصافي</th>
                            <th>الحالة</th>
                            <th>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="salariesTableBody">
        `;

        salaries.forEach(salary => {
            const isPaid = salary.payment_date ? true : false;
            const statusClass = isPaid ? 'status-active' : 'status-pending';
            const statusText = isPaid ? 'مدفوع' : 'معلق';

            html += `
                <tr data-salary-id="${salary.id}">
                    <td>${salary.users?.full_name || salary.users?.email || '-'}</td>
                    <td>${salary.users?.department || '-'}</td>
                    <td>${salary.month || '-'}</td>
                    <td>${(salary.base_salary || 0).toFixed(2)} ج.م</td>
                    <td>${(salary.overtime_hours || 0).toFixed(2)} س</td>
                    <td style="color: #28a745;">${(salary.overtime_bonus || 0).toFixed(2)} ج.م</td>
                    <td style="color: #dc3545;">${(salary.late_deductions || 0).toFixed(2)} ج.م</td>
                    <td style="color: #dc3545;">${(salary.leave_deductions || 0).toFixed(2)} ج.م</td>
                    <td><strong style="color: #007bff; font-size: 1.1em;">${(salary.final_salary || 0).toFixed(2)} ج.م</strong></td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-primary" onclick="viewSalaryDetails('${salary.id}')" title="عرض التفاصيل">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${!isPaid ? `
                                <button class="btn btn-warning" onclick="editSalary('${salary.id}')" title="تعديل">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-success" onclick="markAsPaid('${salary.id}')" title="تأكيد الدفع">
                                    <i class="fas fa-check"></i>
                                </button>
                            ` : `
                                <button class="btn btn-secondary" onclick="printSalarySlip('${salary.id}')" title="طباعة قسيمة">
                                    <i class="fas fa-print"></i>
                                </button>
                            `}
                            <button class="btn btn-danger" onclick="deleteSalary('${salary.id}')" title="حذف">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        section.innerHTML = html;
    } catch (error) {
        console.error('Error loading salaries:', error);
        section.innerHTML = `
            <div class="table-wrapper">
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle fa-2x"></i>
                    <p>حدث خطأ في تحميل البيانات</p>
                </div>
            </div>
        `;
    }
}

window.searchSalaries = function() {
    const searchTerm = document.getElementById('salarySearch')?.value.toLowerCase() || '';
    const monthFilter = document.getElementById('salaryMonth')?.value || '';
    const statusFilter = document.getElementById('salaryStatusFilter')?.value || '';
    const rows = document.querySelectorAll('#salariesTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const month = row.cells[2]?.textContent || '';
        const isPaid = text.includes('مدفوع');
        
        const matchesSearch = !searchTerm || text.includes(searchTerm);
        const matchesMonth = !monthFilter || month.includes(monthFilter);
        const matchesStatus = !statusFilter || 
            (statusFilter === 'paid' && isPaid) || 
            (statusFilter === 'pending' && !isPaid);
        
        row.style.display = (matchesSearch && matchesMonth && matchesStatus) ? '' : 'none';
    });
};

// حساب رواتب الشهر تلقائياً
window.calculateMonthlySalaries = async function() {
    const month = prompt('أدخل الشهر (YYYY-MM):', new Date().toISOString().slice(0, 7));
    if (!month) return;

    try {
        showNotification('جاري حساب الرواتب...', 'info');

        const { data: users, error: usersError } = await sb
            .from('users')
            .select('id, full_name, email, basic_salary, shift_type_id, hourly_rate')
            .eq('status', 'active')
            .eq('role', 'employee');

        if (usersError) throw usersError;

        if (!users || users.length === 0) {
            showNotification('لا يوجد موظفين نشطين لحساب رواتبهم', 'error');
            return;
        }

        let successCount = 0;
        const startDate = `${month}-01`;
        const endDate = new Date(month + '-01');
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);
        const endDateStr = endDate.toISOString().split('T')[0];

        for (const user of users) {
            const { data: existing } = await sb
                .from('salary_calculations')
                .select('id')
                .eq('user_id', user.id)
                .eq('month', month)
                .single();

            if (existing) continue;

            const { data: attendance } = await sb
                .from('attendance')
                .select('date, check_in, check_out')
                .eq('user_id', user.id)
                .gte('date', startDate)
                .lte('date', endDateStr);

            let totalHours = 0;
            let lateMinutes = 0;

            for (const record of attendance || []) {
                if (record.check_in && record.check_out) {
                    const start = new Date(`1970-01-01T${record.check_in}`);
                    const end = new Date(`1970-01-01T${record.check_out}`);
                    const hours = (end - start) / (1000 * 60 * 60);
                    totalHours += hours;
                }

                if (record.check_in) {
                    const dailyLateMinutes = await calculateLateMinutesForAttendance(user.id, record.check_in, record.date);
                    lateMinutes += dailyLateMinutes;
                }
            }

            const workingDays = attendance?.length || 0;
            const expectedHours = workingDays * 8;
            const overtimeHours = Math.max(0, totalHours - expectedHours);

            const { data: leaves } = await sb
                .from('leaves')
                .select('start_date, end_date')
                .eq('user_id', user.id)
                .eq('status', 'approved')
                .gte('start_date', startDate)
                .lte('end_date', endDateStr);

            let unpaidLeaveDays = 0;
            leaves?.forEach(leave => {
                const start = new Date(leave.start_date);
                const end = new Date(leave.end_date);
                const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                unpaidLeaveDays += days;
            });

            const basicSalary = user.basic_salary || 0;
            const dailySalary = basicSalary / 30;
            const hourlySalary = user.hourly_rate || (dailySalary / 8);

            const overtimeBonus = overtimeHours * hourlySalary * 1.5;
            const lateDeductions = (lateMinutes / 60) * hourlySalary;
            const leaveDeductions = unpaidLeaveDays * dailySalary;
            
            const finalSalary = basicSalary + overtimeBonus - lateDeductions - leaveDeductions;

            const { error: insertError } = await sb
                .from('salary_calculations')
                .insert({
                    user_id: user.id,
                    month: month,
                    base_salary: basicSalary,
                    shift_hours: 8,
                    total_work_days: 30,
                    actual_work_days: workingDays,
                    absent_days: 30 - workingDays,
                    late_deductions: lateDeductions,
                    leave_deductions: leaveDeductions,
                    overtime_bonus: overtimeBonus,
                    overtime_hours: overtimeHours,
                    unpaid_leave_days: unpaidLeaveDays,
                    final_salary: finalSalary,
                    created_at: new Date().toISOString()
                });

            if (!insertError) successCount++;
        }

        showNotification(`تم حساب ${successCount} راتب بنجاح`, 'success');
        await loadSalaries();
    } catch (error) {
        console.error('Error calculating salaries:', error);
        showNotification('حدث خطأ أثناء حساب الرواتب: ' + error.message, 'error');
    }
};

// عرض الحسابات اليومية
window.showDailySalaries = async function() {
    const section = document.getElementById('salariesSection');
    section.innerHTML = `
        <div class="table-wrapper">
            <div class="table-header">
                <h3>الحسابات اليومية</h3>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-secondary" onclick="loadSalaries()">
                        <i class="fas fa-calendar"></i> الحسابات الشهرية
                    </button>
                    <button class="btn btn-primary" onclick="calculateDailySalaries()">
                        <i class="fas fa-calculator"></i> حساب اليوم
                    </button>
                    <button class="btn btn-warning" onclick="exportDailySalariesToCSV()">
                        <i class="fas fa-file-export"></i> تصدير
                    </button>
                </div>
            </div>
            
            <div class="search-bar">
                <input type="date" id="dailySalaryDate" value="${new Date().toISOString().split('T')[0]}" onchange="calculateDailySalaries()">
                <input type="text" id="dailySalarySearch" placeholder="البحث عن موظف..." oninput="searchDailySalaries()">
                <select id="dailyStatusFilter" onchange="searchDailySalaries()">
                    <option value="">كل الموظفين</option>
                    <option value="present">حاضر</option>
                    <option value="absent">غائب</option>
                    <option value="late">متأخر</option>
                </select>
            </div>

            <div class="cards" style="margin: 1.5rem 0;">
                <div class="card">
                    <h3><i class="fas fa-users"></i> إجمالي الموظفين</h3>
                    <div class="value" id="dailyTotalEmployees">0</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-user-check"></i> الحاضرين اليوم</h3>
                    <div class="value" id="dailyPresentCount">0</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-money-bill-wave"></i> إجمالي المستحقات اليومية</h3>
                    <div class="value" id="dailyTotalAmount">0 ج.م</div>
                </div>
                <div class="card">
                    <h3><i class="fas fa-exclamation-triangle"></i> إجمالي الخصومات</h3>
                    <div class="value" id="dailyTotalDeductions">0 ج.م</div>
                </div>
            </div>

            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>جاري تحميل البيانات...</p>
            </div>
        </div>
    `;

    await calculateDailySalaries();
};

// حساب الرواتب اليومية
window.calculateDailySalaries = async function() {
    const section = document.getElementById('salariesSection');
    const selectedDate = document.getElementById('dailySalaryDate')?.value || new Date().toISOString().split('T')[0];

    try {
        showNotification('جاري حساب الرواتب اليومية...', 'info');

        // جلب جميع الموظفين النشطين
        const { data: users, error: usersError } = await sb
            .from('users')
            .select('id, full_name, email, basic_salary, shift_type_id, hourly_rate, department, position')
            .eq('status', 'active')
            .eq('role', 'employee');

        if (usersError) throw usersError;

        if (!users || users.length === 0) {
            section.innerHTML = `
                <div class="table-wrapper">
                    <div class="empty-state">
                        <i class="fas fa-users fa-2x"></i>
                        <p>لا يوجد موظفين نشطين</p>
                    </div>
                </div>
            `;
            return;
        }

        // جلب سجلات الحضور لليوم المحدد
        const { data: attendanceRecords, error: attendanceError } = await sb
            .from('attendance')
            .select('*')
            .eq('date', selectedDate);

        if (attendanceError) throw attendanceError;

        const dailyData = [];
        let totalPresent = 0;
        let totalAmount = 0;
        let totalDeductions = 0;

        for (const user of users) {
            const attendance = attendanceRecords?.find(a => a.user_id === user.id);
            
            const basicSalary = user.basic_salary || 0;
            const dailySalary = basicSalary / 30;
            const hourlySalary = user.hourly_rate || (dailySalary / 8);

            let status = 'غائب';
            let checkIn = '-';
            let checkOut = '-';
            let hoursWorked = 0;
            let lateMinutes = 0;
            let overtimeHours = 0;
            let lateDeduction = 0;
            let overtimeBonus = 0;
            let dailyAmount = 0;

            if (attendance && attendance.check_in) {
                status = 'حاضر';
                totalPresent++;
                
                checkIn = new Date(`1970-01-01T${attendance.check_in}`).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                
                if (attendance.check_out) {
                    checkOut = new Date(`1970-01-01T${attendance.check_out}`).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                    
                    const start = new Date(`1970-01-01T${attendance.check_in}`);
                    const end = new Date(`1970-01-01T${attendance.check_out}`);
                    hoursWorked = (end - start) / (1000 * 60 * 60);
                    
                    // حساب الإضافي
                    if (hoursWorked > 8) {
                        overtimeHours = hoursWorked - 8;
                        overtimeBonus = overtimeHours * hourlySalary * 1.5;
                    }
                }

                // حساب التأخير
                lateMinutes = await calculateLateMinutesForAttendance(user.id, attendance.check_in, selectedDate);
                if (lateMinutes > 0) {
                    lateDeduction = (lateMinutes / 60) * hourlySalary;
                    if (status === 'حاضر') status = 'متأخر';
                }

                // حساب المبلغ اليومي
                dailyAmount = dailySalary + overtimeBonus - lateDeduction;
                totalAmount += dailyAmount;
                totalDeductions += lateDeduction;
            }

            dailyData.push({
                user,
                status,
                checkIn,
                checkOut,
                hoursWorked,
                lateMinutes,
                overtimeHours,
                lateDeduction,
                overtimeBonus,
                dailySalary,
                dailyAmount
            });
        }

        // تحديث الإحصائيات
        document.getElementById('dailyTotalEmployees').textContent = users.length;
        document.getElementById('dailyPresentCount').textContent = totalPresent;
        document.getElementById('dailyTotalAmount').textContent = totalAmount.toFixed(2) + ' ج.م';
        document.getElementById('dailyTotalDeductions').textContent = totalDeductions.toFixed(2) + ' ج.م';

        // عرض الجدول
        let html = `
            <div class="table-wrapper">
                <div class="table-header">
                    <h3>الحسابات اليومية - ${new Date(selectedDate).toLocaleDateString('ar-EG')}</h3>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="loadSalaries()">
                            <i class="fas fa-calendar"></i> الحسابات الشهرية
                        </button>
                        <button class="btn btn-primary" onclick="calculateDailySalaries()">
                            <i class="fas fa-calculator"></i> حساب اليوم
                        </button>
                        <button class="btn btn-warning" onclick="exportDailySalariesToCSV()">
                            <i class="fas fa-file-export"></i> تصدير
                        </button>
                    </div>
                </div>
                
                <div class="search-bar">
                    <input type="date" id="dailySalaryDate" value="${selectedDate}" onchange="calculateDailySalaries()">
                    <input type="text" id="dailySalarySearch" placeholder="البحث عن موظف..." oninput="searchDailySalaries()">
                    <select id="dailyStatusFilter" onchange="searchDailySalaries()">
                        <option value="">كل الموظفين</option>
                        <option value="present">حاضر</option>
                        <option value="absent">غائب</option>
                        <option value="late">متأخر</option>
                    </select>
                </div>

                <div class="cards" style="margin: 1.5rem 0;">
                    <div class="card">
                        <h3><i class="fas fa-users"></i> إجمالي الموظفين</h3>
                        <div class="value">${users.length}</div>
                    </div>
                    <div class="card">
                        <h3><i class="fas fa-user-check"></i> الحاضرين اليوم</h3>
                        <div class="value">${totalPresent}</div>
                    </div>
                    <div class="card">
                        <h3><i class="fas fa-money-bill-wave"></i> إجمالي المستحقات اليومية</h3>
                        <div class="value">${totalAmount.toFixed(2)} ج.م</div>
                    </div>
                    <div class="card">
                        <h3><i class="fas fa-exclamation-triangle"></i> إجمالي الخصومات</h3>
                        <div class="value">${totalDeductions.toFixed(2)} ج.م</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>الموظف</th>
                            <th>القسم</th>
                            <th>الحضور</th>
                            <th>الانصراف</th>
                            <th>ساعات العمل</th>
                            <th>التأخير (د)</th>
                            <th>الإضافي (س)</th>
                            <th>الراتب اليومي</th>
                            <th>مكافأة الإضافي</th>
                            <th>خصم التأخير</th>
                            <th>المستحق</th>
                            <th>الحالة</th>
                        </tr>
                    </thead>
                    <tbody id="dailySalariesTableBody">
        `;

        dailyData.forEach(data => {
            let statusClass = 'status-inactive';
            let statusText = data.status;
            
            if (data.status === 'حاضر') statusClass = 'status-active';
            else if (data.status === 'متأخر') statusClass = 'status-pending';

            html += `
                <tr data-status="${data.status}">
                    <td>${data.user.full_name || data.user.email}</td>
                    <td>${data.user.department || '-'}</td>
                    <td>${data.checkIn}</td>
                    <td>${data.checkOut}</td>
                    <td>${data.hoursWorked > 0 ? data.hoursWorked.toFixed(2) : '-'}</td>
                    <td style="color: ${data.lateMinutes > 0 ? '#dc3545' : '#6c757d'};">${data.lateMinutes}</td>
                    <td style="color: ${data.overtimeHours > 0 ? '#28a745' : '#6c757d'};">${data.overtimeHours > 0 ? data.overtimeHours.toFixed(2) : '-'}</td>
                    <td>${data.dailySalary.toFixed(2)} ج.م</td>
                    <td style="color: #28a745;">${data.overtimeBonus > 0 ? '+' + data.overtimeBonus.toFixed(2) : '-'} ج.م</td>
                    <td style="color: #dc3545;">${data.lateDeduction > 0 ? '-' + data.lateDeduction.toFixed(2) : '-'} ج.م</td>
                    <td><strong style="color: #007bff; font-size: 1.1em;">${data.dailyAmount.toFixed(2)} ج.م</strong></td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        section.innerHTML = html;

        showNotification('تم حساب الرواتب اليومية بنجاح', 'success');
    } catch (error) {
        console.error('Error calculating daily salaries:', error);
        showNotification('حدث خطأ أثناء حساب الرواتب اليومية: ' + error.message, 'error');
    }
};

// البحث في الرواتب اليومية
window.searchDailySalaries = function() {
    const searchTerm = document.getElementById('dailySalarySearch')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('dailyStatusFilter')?.value || '';
    const rows = document.querySelectorAll('#dailySalariesTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const rowStatus = row.getAttribute('data-status');
        
        const matchesSearch = !searchTerm || text.includes(searchTerm);
        const matchesStatus = !statusFilter || 
            (statusFilter === 'present' && rowStatus === 'حاضر') ||
            (statusFilter === 'absent' && rowStatus === 'غائب') ||
            (statusFilter === 'late' && rowStatus === 'متأخر');
        
        row.style.display = (matchesSearch && matchesStatus) ? '' : 'none';
    });
};

// تصدير الرواتب اليومية إلى CSV
window.exportDailySalariesToCSV = function() {
    const selectedDate = document.getElementById('dailySalaryDate')?.value || new Date().toISOString().split('T')[0];
    const rows = document.querySelectorAll('#dailySalariesTableBody tr');
    
    if (!rows || rows.length === 0) {
        showNotification('لا توجد بيانات لتصديرها', 'error');
        return;
    }

    let csvContent = 'الموظف,القسم,الحضور,الانصراف,ساعات العمل,التأخير (د),الإضافي (س),الراتب اليومي,مكافأة الإضافي,خصم التأخير,المستحق,الحالة\n';
    
    rows.forEach(row => {
        if (row.style.display !== 'none') {
            const cells = row.querySelectorAll('td');
            const rowData = Array.from(cells).map(cell => {
                let text = cell.textContent.trim();
                text = text.replace(/"/g, '""');
                return `"${text}"`;
            });
            csvContent += rowData.join(',') + '\n';
        }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `daily_salaries_${selectedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('تم تصدير البيانات بنجاح', 'success');
};
window.viewSalaryDetails = async function(salaryId) {
    try {
        const { data: salary, error } = await sb
            .from('salary_calculations')
            .select('*, users(full_name, email, department, position, phone)')
            .eq('id', salaryId)
            .single();

        if (error) throw error;

        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3><i class="fas fa-file-invoice"></i> تفاصيل الراتب</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div style="padding: 1rem;">
                    <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                        <h4 style="margin-bottom: 1rem; color: #007bff;">معلومات الموظف</h4>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                            <div><strong>الاسم:</strong> ${salary.users?.full_name || '-'}</div>
                            <div><strong>البريد:</strong> ${salary.users?.email || '-'}</div>
                            <div><strong>القسم:</strong> ${salary.users?.department || '-'}</div>
                            <div><strong>المسمى:</strong> ${salary.users?.position || '-'}</div>
                        </div>
                    </div>

                    <div style="background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
                        <h4 style="margin-bottom: 1rem; color: #007bff;">تفاصيل الراتب - ${salary.month}</h4>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr style="border-bottom: 1px solid #dee2e6;">
                                <td style="padding: 0.75rem;"><strong>الراتب الأساسي</strong></td>
                                <td style="padding: 0.75rem; text-align: left;">${(salary.base_salary || 0).toFixed(2)} ج.م</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #dee2e6;">
                                <td style="padding: 0.75rem;">أيام العمل الفعلية</td>
                                <td style="padding: 0.75rem; text-align: left;">${salary.actual_work_days || 0} يوم</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #dee2e6;">
                                <td style="padding: 0.75rem;">ساعات إضافية</td>
                                <td style="padding: 0.75rem; text-align: left;">${(salary.overtime_hours || 0).toFixed(2)} ساعة</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #dee2e6; background: #e8f5e9;">
                                <td style="padding: 0.75rem;"><strong style="color: #28a745;">+ مكافأة الساعات الإضافية</strong></td>
                                <td style="padding: 0.75rem; text-align: left; color: #28a745;"><strong>${(salary.overtime_bonus || 0).toFixed(2)} ج.م</strong></td>
                            </tr>
                            <tr style="border-bottom: 1px solid #dee2e6; background: #ffebee;">
                                <td style="padding: 0.75rem;"><strong style="color: #dc3545;">- خصم التأخير</strong></td>
                                <td style="padding: 0.75rem; text-align: left; color: #dc3545;"><strong>${(salary.late_deductions || 0).toFixed(2)} ج.م</strong></td>
                            </tr>
                            <tr style="border-bottom: 1px solid #dee2e6;">
                                <td style="padding: 0.75rem;">أيام الإجازة غير المدفوعة</td>
                                <td style="padding: 0.75rem; text-align: left;">${salary.unpaid_leave_days || 0} يوم</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #dee2e6; background: #ffebee;">
                                <td style="padding: 0.75rem;"><strong style="color: #dc3545;">- خصم الإجازات</strong></td>
                                <td style="padding: 0.75rem; text-align: left; color: #dc3545;"><strong>${(salary.leave_deductions || 0).toFixed(2)} ج.م</strong></td>
                            </tr>
                            <tr style="background: #e3f2fd;">
                                <td style="padding: 1rem;"><strong style="font-size: 1.1em; color: #007bff;">الصافي المستحق</strong></td>
                                <td style="padding: 1rem; text-align: left;"><strong style="font-size: 1.3em; color: #007bff;">${(salary.final_salary || 0).toFixed(2)} ج.م</strong></td>
                            </tr>
                        </table>
                    </div>

                    <div style="display: flex; gap: 1rem; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                        <div>
                            <strong>الحالة:</strong> 
                            <span class="status ${salary.payment_date ? 'status-active' : 'status-pending'}">
                                ${salary.payment_date ? 'مدفوع' : 'معلق'}
                            </span>
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button class="btn btn-primary" onclick="printSalarySlip('${salaryId}')">
                                <i class="fas fa-print"></i> طباعة
                            </button>
                            ${!salary.payment_date ? `
                                <button class="btn btn-success" onclick="markAsPaid('${salaryId}'); this.closest('.modal').remove();">
                                    <i class="fas fa-check"></i> تأكيد الدفع
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        console.error('Error loading salary details:', error);
        showNotification('حدث خطأ في تحميل التفاصيل', 'error');
    }
};

// تعديل راتب
window.editSalary = async function(salaryId) {
    try {
        const { data: salary, error } = await sb
            .from('salary_calculations')
            .select('*')
            .eq('id', salaryId)
            .single();

        if (error) throw error;

        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-edit"></i> تعديل الراتب</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <form id="editSalaryForm">
                    <div class="form-group">
                        <label>الراتب الأساسي</label>
                        <input type="number" id="editBaseSalary" step="0.01" value="${salary.base_salary || 0}" required>
                    </div>
                    <div class="form-group">
                        <label>مكافأة الساعات الإضافية</label>
                        <input type="number" id="editOvertimeBonus" step="0.01" value="${salary.overtime_bonus || 0}">
                    </div>
                    <div class="form-group">
                        <label>خصم التأخير</label>
                        <input type="number" id="editLateDeductions" step="0.01" value="${salary.late_deductions || 0}">
                    </div>
                    <div class="form-group">
                        <label>خصم الإجازات</label>
                        <input type="number" id="editLeaveDeductions" step="0.01" value="${salary.leave_deductions || 0}">
                    </div>
                    <div class="form-group">
                        <label>ملاحظات</label>
                        <textarea id="editNotes">${salary.notes || ''}</textarea>
                    </div>
                    <div id="editSalaryMessage" class="message"></div>
                    <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                        <button type="submit" class="btn btn-primary" style="flex: 1;">
                            <i class="fas fa-save"></i> حفظ التعديلات
                        </button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('editSalaryForm').onsubmit = async function(e) {
            e.preventDefault();
            
            try {
                const updateData = {
                    base_salary: parseFloat(document.getElementById('editBaseSalary').value) || 0,
                    overtime_bonus: parseFloat(document.getElementById('editOvertimeBonus').value) || 0,
                    late_deductions: parseFloat(document.getElementById('editLateDeductions').value) || 0,
                    leave_deductions: parseFloat(document.getElementById('editLeaveDeductions').value) || 0,
                    notes: document.getElementById('editNotes').value
                };

                updateData.final_salary = updateData.base_salary + 
                                         updateData.overtime_bonus - 
                                         updateData.late_deductions - 
                                         updateData.leave_deductions;

                const { error: updateError } = await sb
                    .from('salary_calculations')
                    .update(updateData)
                    .eq('id', salaryId);

                if (updateError) throw updateError;

                showNotification('تم تعديل الراتب بنجاح', 'success');
                modal.remove();
                await loadSalaries();
            } catch (error) {
                console.error('Error updating salary:', error);
                document.getElementById('editSalaryMessage').innerHTML = 
                    `<div class="message error">حدث خطأ: ${error.message}</div>`;
            }
        };
    } catch (error) {
        console.error('Error loading salary for edit:', error);
        showNotification('حدث خطأ في تحميل بيانات الراتب', 'error');
    }
};

// تأكيد دفع الراتب
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
        console.error('Error marking salary as paid:', error);
        showNotification('حدث خطأ أثناء تأكيد الدفع', 'error');
    }
};

// حذف راتب
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
        console.error('Error deleting salary:', error);
        showNotification('حدث خطأ أثناء حذف الراتب', 'error');
    }
};

// طباعة قسيمة الراتب
window.printSalarySlip = async function(salaryId) {
    try {
        const { data: salary, error } = await sb
            .from('salary_calculations')
            .select('*, users(full_name, email, department, position)')
            .eq('id', salaryId)
            .single();

        if (error) throw error;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html dir="rtl">
                <head>
                    <title>قسيمة راتب - ${salary.users?.full_name || 'موظف'}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .header { text-align: center; margin-bottom: 30px; }
                        .info { margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                        th { background-color: #f2f2f2; }
                        .total { background-color: #e3f2fd; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h2>قسيمة راتب</h2>
                        <h3>${salary.users?.full_name || 'موظف'}</h3>
                        <p>الشهر: ${salary.month}</p>
                    </div>
                    
                    <div class="info">
                        <table>
                            <tr><th>الراتب الأساسي</th><td>${(salary.base_salary || 0).toFixed(2)} ج.م</td></tr>
                            <tr><th>أيام العمل</th><td>${salary.actual_work_days || 0} يوم</td></tr>
                            <tr><th>الساعات الإضافية</th><td>${(salary.overtime_bonus || 0).toFixed(2)} ج.م</td></tr>
                            <tr><th>خصم التأخير</th><td>${(salary.late_deductions || 0).toFixed(2)} ج.م</td></tr>
                            <tr><th>خصم الإجازات</th><td>${(salary.leave_deductions || 0).toFixed(2)} ج.م</td></tr>
                            <tr class="total"><th>الصافي المستحق</th><td>${(salary.final_salary || 0).toFixed(2)} ج.م</td></tr>
                        </table>
                    </div>
                    
                    <div style="margin-top: 30px; text-align: center;">
                        <p>الحالة: ${salary.payment_date ? 'مدفوع' : 'معلق'}</p>
                        <p>التاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    } catch (error) {
        console.error('Error printing salary slip:', error);
        showNotification('حدث خطأ أثناء طباعة قسيمة الراتب', 'error');
    }
};

// تصدير الرواتب إلى CSV
window.exportSalariesToCSV = async function() {
    try {
        const { data: salaries, error } = await sb
            .from('salary_calculations')
            .select('*, users(full_name, email, department, position)')
            .order('month', { ascending: false });

        if (error) throw error;

        if (!salaries || salaries.length === 0) {
            showNotification('لا توجد بيانات لتصديرها', 'error');
            return;
        }

        let csvContent = 'الموظف,البريد,القسم,المسمى,الشهر,الأساسي,الإضافي,خصم التأخير,خصم الإجازات,الصافي,الحالة\n';
        
        salaries.forEach(salary => {
            const row = [
                `"${salary.users?.full_name || ''}"`,
                `"${salary.users?.email || ''}"`,
                `"${salary.users?.department || ''}"`,
                `"${salary.users?.position || ''}"`,
                `"${salary.month || ''}"`,
                salary.base_salary || 0,
                salary.overtime_bonus || 0,
                salary.late_deductions || 0,
                salary.leave_deductions || 0,
                salary.final_salary || 0,
                salary.payment_date ? 'مدفوع' : 'معلق'
            ].join(',');
            csvContent += row + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `salaries_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('تم تصدير البيانات بنجاح', 'success');
    } catch (error) {
        console.error('Error exporting salaries to CSV:', error);
        showNotification('حدث خطأ أثناء تصدير البيانات', 'error');
    }
};

// تحميل التقارير
function loadReports() {
    const section = document.getElementById('reportsSection');
    section.innerHTML = `
        <div class="table-wrapper">
            <h3>التقارير والإحصائيات</h3>
            <p>قريباً...</p>
        </div>
    `;
}



// تسجيل الخروج
window.logout = async function() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        try {
            await sb.auth.signOut();
            window.location.href = '/index.html';
        } catch (error) {
            console.error('Error signing out:', error);
            showNotification('حدث خطأ أثناء تسجيل الخروج', 'error');
        }
    }
}

// إغلاق النوافذ عند النقر خارجها
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('show');
    }
}

// إعدادات القائمة الجانبية
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('sidebar');
const sidebarClose = document.getElementById('sidebarClose');

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.add('active');
    });
}

if (sidebarClose) {
    sidebarClose.addEventListener('click', () => {
        sidebar.classList.remove('active');
    });
}

document.addEventListener('click', (e) => {
    if (window.innerWidth <= 992 && 
        sidebar && !sidebar.contains(e.target) && 
        mobileMenuBtn && e.target !== mobileMenuBtn && 
        !mobileMenuBtn.contains(e.target)) {
        sidebar.classList.remove('active');
    }
});

// التهيئة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
    const session = await checkAdminSession();
    if (session) {
        await updateCache();
        await loadStats();
        
        // تحميل التاب النشط (الافتراضي: الموظفين)
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            const tabText = activeTab.textContent.trim();
            if (tabText.includes('الموظفين')) {
                await loadUsers();
            } else if (tabText.includes('الحضور')) {
                await loadAttendance();
            } else if (tabText.includes('الإجازات')) {
                await loadLeaves();
            } else if (tabText.includes('الرواتب')) {
                await loadSalaries();
            } else if (tabText.includes('الإعدادات')) {
                loadDepartmentsSettings();
            }
        } else {
            await loadUsers(); // افتراضي
        }
    }
});



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

// دالة حساب التأخير حسب الشيفت
async function calculateLateMinutesForAttendance(userId, checkInTimeStr, dateStr) {
    try {
        const { data: userData, error: userError } = await sb
            .from('users')
            .select('shift_type_id')
            .eq('id', userId)
            .single();

        if (userError || !userData || !userData.shift_type_id) {
            return 0;
        }

        const { data: shiftData, error: shiftError } = await sb
            .from('work_shifts')
            .select('start_time, end_time')
            .eq('id', userData.shift_type_id)
            .single();

        if (shiftError || !shiftData || !shiftData.start_time) {
            return 0;
        }

        const shiftStartDate = new Date(`${dateStr}T${shiftData.start_time}`);
        let shiftEndDate = new Date(`${dateStr}T${shiftData.end_time}`);

        if (shiftEndDate < shiftStartDate) {
            shiftEndDate.setDate(shiftEndDate.getDate() + 1);
        }

        const checkInDate = new Date(`${dateStr}T${checkInTimeStr}`);

        let lateMinutes = 0;
        if (checkInDate > shiftStartDate) {
            const timeDiffMs = checkInDate - shiftStartDate;
            lateMinutes = Math.ceil(timeDiffMs / (1000 * 60));
        }

        return Math.max(0, lateMinutes);
    } catch (error) {
        console.error('Error calculating late minutes:', error);
        return 0;
    }
}

// تحميل الحضور
async function loadAttendance() {
    const section = document.getElementById('attendanceSection');
    section.innerHTML = `
        <div class="table-wrapper">
            <div class="table-header">
                <h3>سجل الحضور والانصراف (آخر 30 يوم)</h3>
            </div>
            <div class="search-bar">
                <input type="text" id="attendanceSearch" placeholder="البحث عن موظف..." oninput="searchAttendance()">
                <input type="date" id="attendanceDate" onchange="searchAttendance()">
                <button class="btn btn-primary" onclick="searchAttendance()">
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
            section.innerHTML = `
                <div class="table-wrapper">
                    <div class="table-header">
                        <h3>سجل الحضور والانصراف (آخر 30 يوم)</h3>
                    </div>
                    <div class="search-bar">
                        <input type="text" id="attendanceSearch" placeholder="البحث عن موظف..." oninput="searchAttendance()">
                        <input type="date" id="attendanceDate" onchange="searchAttendance()">
                        <button class="btn btn-primary" onclick="searchAttendance()">
                            <i class="fas fa-search"></i> بحث
                        </button>
                    </div>
                    <div class="empty-state">
                        <i class="fas fa-clock fa-2x"></i>
                        <p>لا يوجد سجلات حضور</p>
                    </div>
                </div>
            `;
            return;
        }

        let html = `
            <div class="table-wrapper">
                <div class="table-header">
                    <h3>سجل الحضور والانصراف (آخر 30 يوم)</h3>
                </div>
                <div class="search-bar">
                    <input type="text" id="attendanceSearch" placeholder="البحث عن موظف..." oninput="searchAttendance()">
                    <input type="date" id="attendanceDate" onchange="searchAttendance()">
                    <button class="btn btn-primary" onclick="searchAttendance()">
                        <i class="fas fa-search"></i> بحث
                    </button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>الموظف</th>
                            <th>التاريخ</th>
                            <th>وقت الحضور</th>
                            <th>وقت الانصراف</th>
                            <th>عدد الساعات</th>
                            <th>التأخير (د)</th>
                            <th>الحالة</th>
                        </tr>
                    </thead>
                    <tbody id="attendanceTableBody">
        `;

        for (const record of attendance) {
            const checkIn = record.check_in ? new Date(`1970-01-01T${record.check_in}`).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-';
            const checkOut = record.check_out ? new Date(`1970-01-01T${record.check_out}`).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-';
            
            let hours = '-';
            if (record.check_in && record.check_out) {
                const inTime = new Date(`1970-01-01T${record.check_in}`);
                const outTime = new Date(`1970-01-01T${record.check_out}`);
                const diff = (outTime - inTime) / (1000 * 60 * 60);
                hours = diff.toFixed(2);
            }

            let lateMinutes = 0;
            if (record.check_in && record.user_id) {
                lateMinutes = await calculateLateMinutesForAttendance(record.user_id, record.check_in, record.date);
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
                    <td>${lateMinutes}</td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                </tr>
            `;
        }

        html += '</tbody></table></div>';
        section.innerHTML = html;
    } catch (error) {
        console.error('Error loading attendance:', error);
        section.innerHTML = `
            <div class="table-wrapper">
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle fa-2x"></i>
                    <p>حدث خطأ في تحميل البيانات</p>
                </div>
            </div>
        `;
    }
}

window.searchAttendance = function() {
    const searchTerm = document.getElementById('attendanceSearch')?.value.toLowerCase() || '';
    const dateFilter = document.getElementById('attendanceDate')?.value || '';
    const rows = document.querySelectorAll('#attendanceTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const date = row.cells[1]?.textContent || '';
        
        const matchesSearch = !searchTerm || text.includes(searchTerm);
        const matchesDate = !dateFilter || date.includes(dateFilter);
        
        row.style.display = (matchesSearch && matchesDate) ? '' : 'none';
    });
};

// تحميل طلبات الإجازات
async function loadLeaves() {
    const section = document.getElementById('leavesSection');
    section.innerHTML = `
        <div class="table-wrapper">
            <div class="table-header">
                <h3>طلبات الإجازات</h3>
            </div>
            <div class="search-bar">
                <input type="text" id="leaveSearch" placeholder="البحث عن موظف..." oninput="searchLeaves()">
                <select id="leaveStatus" onchange="searchLeaves()">
                    <option value="">جميع الحالات</option>
                    <option value="pending">معلق</option>
                    <option value="approved">موافق</option>
                    <option value="rejected">مرفوض</option>
                </select>
                <button class="btn btn-primary" onclick="searchLeaves()">
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
        const { data: leaves, error } = await sb
            .from('leaves')
            .select('*, users(full_name, email)')
            .order('start_date', { ascending: false });

        if (error) throw error;

        if (!leaves || leaves.length === 0) {
            section.innerHTML = `
                <div class="table-wrapper">
                    <div class="table-header">
                        <h3>طلبات الإجازات</h3>
                    </div>
                    <div class="empty-state">
                        <i class="fas fa-calendar-alt fa-2x"></i>
                        <p>لا يوجد طلبات إجازات</p>
                    </div>
                </div>
            `;
            return;
        }

        let html = `
            <div class="table-wrapper">
                <div class="table-header">
                    <h3>طلبات الإجازات</h3>
                </div>
                <div class="search-bar">
                    <input type="text" id="leaveSearch" placeholder="البحث عن موظف..." oninput="searchLeaves()">
                    <select id="leaveStatus" onchange="searchLeaves()">
                        <option value="">جميع الحالات</option>
                        <option value="pending">معلق</option>
                        <option value="approved">موافق</option>
                        <option value="rejected">مرفوض</option>
                    </select>
                    <button class="btn btn-primary" onclick="searchLeaves()">
                        <i class="fas fa-search"></i> بحث
                    </button>
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
                    <tbody id="leavesTableBody">
        `;

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
                                <button class="btn btn-success" onclick="approveLeave('${leave.id}')" title="موافقة">
                                    <i class="fas fa-check"></i>
                                </button>
                                <button class="btn btn-danger" onclick="rejectLeave('${leave.id}')" title="رفض">
                                    <i class="fas fa-times"></i>
                                </button>
                            ` : `<span style="color: #999;">تم المعالجة</span>`}
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        section.innerHTML = html;
    } catch (error) {
        console.error('Error loading leaves:', error);
        section.innerHTML = `
            <div class="table-wrapper">
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle fa-2x"></i>
                    <p>حدث خطأ في تحميل البيانات</p>
                </div>
            </div>
        `;
    }
}

window.searchLeaves = function() {
    const searchTerm = document.getElementById('leaveSearch')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('leaveStatus')?.value || '';
    const rows = document.querySelectorAll('#leavesTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        
        const matchesSearch = !searchTerm || text.includes(searchTerm);
        const matchesStatus = !statusFilter || text.includes(statusFilter);
        
        row.style.display = (matchesSearch && matchesStatus) ? '' : 'none';
    });
};

// الموافقة على إجازة
window.approveLeave = async function(id) {
    if (!confirm('هل أنت متأكد من الموافقة على هذه الإجازة؟')) {
        return;
    }

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
        console.error('Error approving leave:', error);
        showNotification('حدث خطأ: ' + error.message, 'error');
    }
}

// رفض إجازة
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
        console.error('Error rejecting leave:', error);
        showNotification('حدث خطأ: ' + error.message, 'error');
    }
}

// تحميل إعدادات الأقسام والمُسميات الوظيفية
window.loadDepartmentsSettings = async function(event) {
  document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
  event?.target.classList.add('active');

  const content = document.getElementById('settingsSection')
;
  content.innerHTML = `
    <div class="loading"><i class="fas fa-spinner fa-spin"></i><p>جاري التحميل...</p></div>
  `;

  try {
    // جلب الأقسام والمُسميات من القاعدة
    const { data: departments, error: depError } = await sb.from('departments').select('*');
const { data: positions, error: posError } = await sb.from("positions").select("id, name");

    if (depError) throw depError;
    if (posError) throw posError;

    let html = `
      <div style="display: flex; justify-content: space-between; align-items:center; margin-bottom: 1rem;">
        <h3><i class="fas fa-cog"></i> إدارة البيانات الثابتة</h3>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">

        <!-- إدارة الأقسام -->
        <div style="background: #f8f9fa; padding: 1rem; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items:center; margin-bottom: 1rem;">
            <h4><i class="fas fa-building"></i> الأقسام</h4>
            <button class="btn btn-primary" onclick="addDepartment()">
              <i class="fas fa-plus"></i> إضافة قسم
            </button>
          </div>
          <table class="table">
            <thead><tr><th>القسم</th><th>الوصف</th><th>إجراءات</th></tr></thead>
            <tbody>
    `;

    if (departments?.length) {
      departments.forEach(d => {
        html += `
          <tr>
            <td>${d.name}</td>
            <td>${d.description || '-'}</td>
            <td>
              <button class="btn btn-sm" onclick="editDepartment(${d.id}, '${d.name}', '${d.description || ''}')">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-danger" onclick="deleteDepartment(${d.id})">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      });
    } else {
      html += '<tr><td colspan="3" style="text-align:center;">لا توجد أقسام</td></tr>';
    }

    html += `
            </tbody>
          </table>
        </div>

        <!-- إدارة المُسميات الوظيفية -->
        <div style="background: #f8f9fa; padding: 1rem; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items:center; margin-bottom: 1rem;">
            <h4><i class="fas fa-id-badge"></i> المسميات الوظيفية</h4>
            <button class="btn btn-primary" onclick="addPosition()">
              <i class="fas fa-plus"></i> إضافة مسمى
            </button>
          </div>
          <table class="table">
            <thead><tr><th>المسمى</th><th>الوصف</th><th>إجراءات</th></tr></thead>
            <tbody>
    `;

    if (positions?.length) {
      positions.forEach(p => {
        html += `
          <tr>
            <td>${p.name}</td>
            <td>${p.description || '-'}</td>
            <td>
              <button class="btn btn-sm" onclick="editPosition(${p.id}, '${p.name}', '${p.description || ''}')">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-danger" onclick="deletePosition(${p.id})">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      });
    } else {
      html += '<tr><td colspan="3" style="text-align:center;">لا توجد مسميات وظيفية</td></tr>';
    }

    html += `
            </tbody>
          </table>
        </div>

      </div>
    `;

    content.innerHTML = html;

  } catch (err) {
    console.error(err);
    content.innerHTML = '<p>حدث خطأ أثناء تحميل الإعدادات.</p>';
  }
};

// ===============================
// عمليات الأقسام
// ===============================
window.addDepartment = async function() {
  const name = prompt("اسم القسم:");
  if (!name) return;
  await sb.from('departments').insert([{ name }]);
  loadDepartmentsSettings();
};

window.editDepartment = async function(id, oldName, oldDesc) {
  const name = prompt("اسم القسم:", oldName);
  if (!name) return;
  const description = prompt("الوصف:", oldDesc);
  await sb.from('departments').update({ name, description }).eq('id', id);
  loadDepartmentsSettings();
};

window.deleteDepartment = async function(id) {
  if (confirm("هل أنت متأكد من حذف هذا القسم؟")) {
    await sb.from('departments').delete().eq('id', id);
    loadDepartmentsSettings();
  }
};

// ===============================
// عمليات المسميات الوظيفية
// ===============================
window.addPosition = async function() {
  const name = prompt("اسم المسمى الوظيفي:");
  if (!name) return;
  await sb.from('positions').insert([{ name }]);
  loadDepartmentsSettings();
};

window.editPosition = async function(id, oldName, oldDesc) {
  const name = prompt("اسم المسمى الوظيفي:", oldName);
  if (!name) return;
  const description = prompt("الوصف:", oldDesc);
  await sb.from('positions').update({ name, description }).eq('id', id);
  loadDepartmentsSettings();
};

window.deletePosition = async function(id) {
  if (confirm("هل أنت متأكد من حذف هذا المسمى الوظيفي؟")) {
    await sb.from('positions').delete().eq('id', id);
    loadDepartmentsSettings();
  }
};
