// Import the Supabase client
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://nxhnivykhlnauewpmuqv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54aG5pdnlraGxuYXVld3BtdXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4Mjk2NTYsImV4cCI6MjA3NDQwNTY1Nn0.-3ps3Mp7aYuA2m54sW3gNN3CpZ2acRtKGj8jI5eHTOU";
window.supabase = createClient(supabaseUrl, supabaseKey);

// ثوابت التطبيق
const STATUS_TYPES = {
    WORKING: 'working',
    MISSING_CHECKOUT: 'missing_checkout',
    COMPLETE: 'complete',
    ABSENT: 'absent'
};

const STATUS_TEXT = {
    [STATUS_TYPES.WORKING]: 'جاري العمل',
    [STATUS_TYPES.MISSING_CHECKOUT]: 'لم يسجل انصراف',
    [STATUS_TYPES.COMPLETE]: 'مكتمل',
    [STATUS_TYPES.ABSENT]: 'غائب'
};

// موقع الشركة (الإحداثيات من الكود الأصلي)
const companyLocation = {
    lat: 30.4763889,
    lng: 31.1798333
};

// نصف قطر مسموح (مثلاً 200 متر)
const allowedRadius = 200;

// متغير لتخزين المستخدم الحالي
window.currentUser = null;

// متغير لتخزين الشهر الحالي في التقويم
window.currentMonth = new Date();

// دالة لحساب المسافة بين نقطتين (Haversine Formula)
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // نصف قطر الأرض بالمتر
    const toRad = (deg) => (deg * Math.PI) / 180;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // المسافة بالمتر
}

// دالة جلب الموقع
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('متصفحك لا يدعم تحديد الموقع'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            },
            (error) => {
                let errorMessage = 'حدث خطأ في تحديد موقعك';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'يرجى السماح بتحديد موقعك لتسجيل الحضور';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'معلومات الموقع غير متوفرة';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'انتهت مهلة تحديد الموقع';
                        break;
                }
                reject(new Error(errorMessage));
            }
        );
    });
}

// دالة تسجيل الحضور
export async function recordCheckIn() {
    try {
        const location = await getUserLocation();
        const distance = getDistanceInMeters(
            location.lat,
            location.lng,
            companyLocation.lat,
            companyLocation.lng
        );

        if (distance > allowedRadius) {
            throw new Error(`يجب أن تكون داخل نطاق الشركة (المسافة: ${Math.round(distance)} م) لتسجيل الحضور`);
        }

        const today = new Date().toISOString().split('T')[0];
        const time = new Date().toTimeString().split(' ')[0].substring(0, 5); // HH:MM

        // التحقق من عدم وجود تسجيل سابق
        const existingRecord = await fetchAttendanceForDate(window.currentUser.id, today);
        if (existingRecord?.check_in) {
            throw new Error('تم تسجيل الحضور مسبقاً');
        }

        const { error } = await window.supabase
            .from('attendance')
            .insert([{
                user_id: window.currentUser.id,
                date: today,
                check_in: time,
                status: STATUS_TYPES.WORKING,
                check_in_lat: location.lat,
                check_in_lng: location.lng
            }]);

        if (error) throw error;

        showNotification(`تم تسجيل الحضور بنجاح الساعة ${time}`, 'success');
        document.getElementById('checkInBtn').disabled = true;
        document.getElementById('checkInTime').textContent = time;
        
        // تحديث الواجهة
        await Promise.all([
            loadAttendanceList(),
            loadAttendanceCalendar(),
            calculateExpectedSalary()
        ]);

    } catch (error) {
        console.error("Error recording check-in:", error);
        showNotification(error.message || 'فشل تسجيل الحضور', 'error');
    }
}

// دالة تسجيل الانصراف
export async function recordCheckOut() {
    try {
        const location = await getUserLocation();
        const distance = getDistanceInMeters(
            location.lat,
            location.lng,
            companyLocation.lat,
            companyLocation.lng
        );

        if (distance > allowedRadius) {
            throw new Error(`يجب أن تكون داخل نطاق الشركة (المسافة: ${Math.round(distance)} م) لتسجيل الانصراف`);
        }

        const today = new Date().toISOString().split('T')[0];
        const time = new Date().toTimeString().split(' ')[0].substring(0, 5); // HH:MM

        const existingRecord = await fetchAttendanceForDate(window.currentUser.id, today);
        if (!existingRecord?.check_in) {
            throw new Error('يجب تسجيل الحضور أولاً');
        }
        if (existingRecord.check_out) {
            throw new Error('تم تسجيل الانصراف مسبقاً');
        }

        const { error } = await window.supabase
            .from('attendance')
            .update({
                check_out: time,
                status: STATUS_TYPES.COMPLETE,
                check_out_lat: location.lat,
                check_out_lng: location.lng
            })
            .eq('id', existingRecord.id);

        if (error) throw error;

        showNotification(`تم تسجيل الانصراف بنجاح الساعة ${time}`, 'success');
        document.getElementById('checkOutBtn').disabled = true;
        document.getElementById('checkOutTime').textContent = time;

        // تحديث الواجهة
        await Promise.all([
            loadAttendanceList(),
            loadAttendanceCalendar(),
            calculateExpectedSalary()
        ]);

    } catch (error) {
        console.error("Error recording check-out:", error);
        showNotification(error.message || 'فشل تسجيل الانصراف', 'error');
    }
}

// دالة التحقق من الحضور اليوم
export async function checkTodayAttendance() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const record = await fetchAttendanceForDate(window.currentUser.id, today);
        
        if (record) {
            if (record.check_in) {
                document.getElementById('checkInBtn').disabled = true;
                document.getElementById('checkInTime').textContent = record.check_in;
            }
            if (record.check_out) {
                document.getElementById('checkOutBtn').disabled = true;
                document.getElementById('checkOutTime').textContent = record.check_out;
            }
            
            // تحديث الحالة
            const statusText = STATUS_TEXT[record.status] || record.status;
            document.getElementById('attendanceStatus').textContent = statusText;
        } else {
            // إذا لم يكن هناك تسجيل اليوم، فكّر الأزرار
            document.getElementById('checkInBtn').disabled = false;
            document.getElementById('checkOutBtn').disabled = true; // لا يمكن تسجيل الانصراف بدون حضور
            document.getElementById('checkInTime').textContent = '-';
            document.getElementById('checkOutTime').textContent = '-';
            document.getElementById('attendanceStatus').textContent = 'لم يتم التسجيل';
        }
    } catch (error) {
        console.error('Error checking today attendance:', error);
        showNotification('حدث خطأ في التحقق من الحضور اليوم', 'error');
    }
}

// جلب بيانات المستخدم من جدول users
export async function fetchUserProfile(userId) {
    try {
        const { data, error } = await window.supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
}

// جلب الراتب من جدول salaries
export async function fetchSalary(userId) {
    try {
        const { data, error } = await window.supabase
            .from('salaries')
            .select('*')
            .eq('user_id', userId)
            .order('month', { ascending: false })
            .limit(1);
        if (error) throw error;
        return data && data.length > 0 ? data[0] : null;
    } catch (error) {
        console.error("Error fetching salary:", error);
        return null;
    }
}

// جلب سجل الحضور من جدول attendance
export async function fetchAttendance(userId) {
    try {
        const { data, error } = await window.supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(10);
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Error fetching attendance:", error);
        return [];
    }
}

// جلب سجل الحضور لهذا الشهر
export async function fetchAttendanceForMonth(userId, year, month) {
    try {
        const { data, error } = await window.supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
            .lt('date', `${year}-${String(month + 1).padStart(2, '0')}-01`);
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Error fetching attendance for month:", error);
        return [];
    }
}

// جلب سجل الحضور لتاريخ محدد
export async function fetchAttendanceForDate(userId, date) {
    try {
        const { data, error } = await window.supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .eq('date', date)
            .single();
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 يعني لا يوجد سجل
        return data;
    } catch (error) {
        console.error("Error fetching attendance for date:", error);
        return null;
    }
}

// جلب طلبات الإجازة من جدول leaves
export async function fetchLeaves(userId) {
    try {
        const { data, error } = await window.supabase
            .from('leaves')
            .select('*')
            .eq('user_id', userId)
            .order('start_date', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Error fetching leaves:", error);
        return [];
    }
}

// تقديم طلب إجازة
export async function submitLeaveRequest(leaveData) {
    try {
        // بناء كائن الإدخال بشكل ديناميكي
        const insertData = {
            user_id: window.currentUser.id,
            start_date: leaveData.start_date,
            end_date: leaveData.end_date,
            type: leaveData.type,
            status: 'pending'
        };
        // إضافة الحقل 'reason' فقط إذا كان موجودًا في النموذج
        if (leaveData.reason) {
            insertData.reason = leaveData.reason;
        }
        const { error } = await window.supabase
            .from('leaves')
            .insert([insertData]);
        if (error) throw error;
        showNotification('تم إرسال طلب الإجازة بنجاح', 'success');
        document.getElementById('leaveForm').reset();
        loadLeaveRequests();
    } catch (error) {
        console.error("Error submitting leave request:", error);
        showNotification('فشل إرسال طلب الإجازة: ' + error.message, 'error');
    }
}

// تحميل الملف الشخصي
export async function loadUserProfile() {
    const profile = await fetchUserProfile(window.currentUser.id);
    const detailsDiv = document.getElementById('profileDetails');
    if (profile) {
        const firstName = profile.full_name ? profile.full_name.charAt(0) : 'م';
        document.getElementById('userAvatar').textContent = firstName;
        document.getElementById('userName').textContent = profile.full_name || 'موظف';
        document.getElementById('userRole').textContent = profile.role || 'موظف';
        detailsDiv.innerHTML = `
            <div class="profile-item">
                <div class="profile-label">الاسم:</div>
                <div class="profile-value">${profile.full_name || 'غير محدد'}</div>
            </div>
            <div class="profile-item">
                <div class="profile-label">البريد الإلكتروني:</div>
                <div class="profile-value">${profile.email || 'غير محدد'}</div>
            </div>
            <div class="profile-item">
                <div class="profile-label">الهاتف:</div>
                <div class="profile-value">${profile.phone || 'غير محدد'}</div>
            </div>
            <div class="profile-item">
                <div class="profile-label">الرقم الوطني:</div>
                <div class="profile-value">${profile.national_id || 'غير محدد'}</div>
            </div>
            <div class="profile-item">
                <div class="profile-label">تاريخ التوظيف:</div>
                <div class="profile-value">${profile.hire_date || 'غير محدد'}</div>
            </div>
            <div class="profile-item">
                <div class="profile-label">الحالة:</div>
                <div class="profile-value">${profile.status || 'غير محدد'}</div>
            </div>
            <div class="profile-item">
                <div class="profile-label">الدور:</div>
                <div class="profile-value">${profile.role || 'غير محدد'}</div>
            </div>
            <div class="profile-item">
                <div class="profile-label">القسم:</div>
                <div class="profile-value">${profile.department || 'غير محدد'}</div>
            </div>
            <div class="profile-item">
                <div class="profile-label">الوظيفة:</div>
                <div class="profile-value">${profile.position || 'غير محدد'}</div>
            </div>
            <div class="profile-item">
                <div class="profile-label">عدد ساعات الشيفت:</div>
                <div class="profile-value">${profile.shift_type || 'غير محدد'} ساعة</div>
            </div>
        `;
    } else {
        detailsDiv.innerHTML = '<p class="message error">لا يمكن تحميل معلومات الملف الشخصي.</p>';
    }
}

// تحميل معلومات الراتب
export async function loadSalaryInfo() {
    const salary = await fetchSalary(window.currentUser.id);
    const salaryDiv = document.getElementById('salaryInfo');
    if (salary) {
        salaryDiv.innerHTML = `
            <div class="salary-item">
                <div class="salary-label">الشهر:</div>
                <div class="salary-value">${salary.month || 'غير محدد'}</div>
            </div>
            <div class="salary-item">
                <div class="salary-label">الراتب الأساسي:</div>
                <div class="salary-value">${salary.base_salary || 0} ج.م</div>
            </div>
            <div class="salary-item">
                <div class="salary-label">الحوافز:</div>
                <div class="salary-value">${salary.bonuses || 0} ج.م</div>
            </div>
            <div class="salary-item">
                <div class="salary-label">الخصومات:</div>
                <div class="salary-value">${salary.deductions || 0} ج.م</div>
            </div>
            <div class="salary-item total-salary">
                <div class="salary-label">الراتب الصافي:</div>
                <div class="salary-value">${salary.net_salary || 0} ج.م</div>
            </div>
        `;
    } else {
        salaryDiv.innerHTML = '<p class="message error">لا توجد معلومات راتب متاحة حالياً.</p>';
    }
}

// تحميل سجل الحضور
export async function loadAttendanceList() {
    const attendanceRecords = await fetchAttendance(window.currentUser.id);
    const listDiv = document.getElementById('attendanceList');
    if (attendanceRecords && attendanceRecords.length > 0) {
        listDiv.innerHTML = '';
        attendanceRecords.forEach(record => {
            const date = new Date(record.date);
            // تنسيق التاريخ إلى ميلادي
            const formattedDate = date.toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            const attendanceItem = document.createElement('div');
            attendanceItem.className = 'attendance-item';
            attendanceItem.innerHTML = `
                <div class="attendance-date">${formattedDate}</div>
                <div class="attendance-times">
                    <div class="time-item">
                        <span class="time-label">الحضور</span>
                        <span class="time-value">${record.check_in || 'لم يسجل'}</span>
                    </div>
                    <div class="time-item">
                        <span class="time-label">الانصراف</span>
                        <span class="time-value">${record.check_out || 'لم يسجل'}</span>
                    </div>
                </div>
                <div><span class="status-badge status-${record.status === 'present' || record.status === 'complete' ? 'present' : record.status === 'absent' ? 'absent' : record.status === 'working' ? 'working' : 'missing-checkout'}">${STATUS_TEXT[record.status] || record.status}</span></div>
            `;
            listDiv.appendChild(attendanceItem);
        });
    } else {
        listDiv.innerHTML = '<p class="message error">لا توجد سجلات حضور متاحة.</p>';
    }
}

// تحميل تقويم الحضور
export async function loadAttendanceCalendar() {
    const year = window.currentMonth.getFullYear();
    const month = window.currentMonth.getMonth();
    document.getElementById('currentMonth').textContent = 
        `${new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    const attendanceRecords = await fetchAttendanceForMonth(window.currentUser.id, year, month + 1);
    const calendarDates = document.getElementById('calendarDates');
    // Clear calendar
    calendarDates.innerHTML = '';
    // Get first day of month and last day of month
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Add empty cells for days before the first day
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-date';
        calendarDates.appendChild(emptyCell);
    }
    // Add cells for each day of the month
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const date = new Date(year, month, day);
        const dateCell = document.createElement('div');
        dateCell.className = 'calendar-date';
        dateCell.textContent = day;
        // Check if this date is today
        if (date.toDateString() === today.toDateString()) {
            dateCell.classList.add('today');
        }
        // Check attendance status for this date
        const attendance = attendanceRecords.find(record => record.date === dateStr);
        if (attendance) {
            if (attendance.status === 'complete') {
                dateCell.classList.add('present');
            } else if (attendance.status === 'absent') {
                dateCell.classList.add('absent');
            } else if (attendance.status === 'working') {
                dateCell.classList.add('working');
            } else if (attendance.status === 'missing_checkout') {
                dateCell.classList.add('missing-checkout');
            }
        }
        calendarDates.appendChild(dateCell);
    }
    // Calculate attendance stats
    const presentDays = attendanceRecords.filter(record => record.status === 'complete').length;
    const absentDays = attendanceRecords.filter(record => record.status === 'absent').length;
    const lateDays = attendanceRecords.filter(record => {
        if (record.check_in) {
            const checkInTime = new Date(`1970-01-01T${record.check_in}`);
            const standardTime = new Date('1970-01-01T09:00:00');
            return checkInTime > standardTime;
        }
        return false;
    }).length;
    const missingCheckoutDays = attendanceRecords.filter(record => record.status === 'missing_checkout').length;
    document.getElementById('presentDays').textContent = presentDays;
    document.getElementById('absentDays').textContent = absentDays;
    document.getElementById('lateDays').textContent = lateDays;
    document.getElementById('missingCheckoutDays').textContent = missingCheckoutDays;
}

// تحميل طلبات الإجازة
export async function loadLeaveRequests() {
    const leaves = await fetchLeaves(window.currentUser.id);
    const listDiv = document.getElementById('leaveRequests');
    if (leaves && leaves.length > 0) {
        listDiv.innerHTML = '';
        leaves.forEach(leave => {
            const startDate = new Date(leave.start_date);
            const endDate = new Date(leave.end_date);
            // تنسيق التواريخ إلى ميلادي
            const startStr = startDate.toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            const endStr = endDate.toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            const typeText = {
                'annual': 'سنوية',
                'sick': 'مرضية',
                'emergency': 'طارئة',
                'unpaid': 'بدون راتب'
            }[leave.type] || leave.type;
            const statusText = {
                'pending': 'معلق',
                'approved': 'مقبول',
                'rejected': 'مرفوض'
            }[leave.status] || leave.status;
            const leaveItem = document.createElement('div');
            leaveItem.className = 'leave-item';
            // استخدام leave.reason || 'غير محدد' للتعامل مع الحقل المحتمل أن يكون غير موجود
            leaveItem.innerHTML = `
                <div class="leave-header">
                    <div class="leave-dates">من ${startStr} إلى ${endStr}</div>
                    <div class="leave-status status-${leave.status}">${statusText}</div>
                </div>
                <div class="leave-details">
                    <div>نوع الإجازة: ${typeText}</div>
                    <div>السبب: ${(leave.reason !== undefined) ? leave.reason : 'غير محدد'}</div>
                </div>
            `;
            listDiv.appendChild(leaveItem);
        });
    } else {
        listDiv.innerHTML = '<p class="message error">لا توجد طلبات إجازة.</p>';
    }
}

// حساب الراتب المتوقع للشهر الحالي
export async function calculateExpectedSalary() {
    try {
        const profile = await fetchUserProfile(window.currentUser.id);
        if (!profile) return;
        const currentMonth = new Date().toISOString().substring(0, 7);
        const year = new Date().getFullYear();
        const month = new Date().getMonth() + 1;
        const daysInMonth = new Date(year, month, 0).getDate();
        // جلب حضور الشهر الحالي
        const { data: attendance, error } = await window.supabase
            .from('attendance')
            .select('*')
            .eq('user_id', window.currentUser.id)
            .gte('date', `${currentMonth}-01`)
            .lte('date', `${currentMonth}-${daysInMonth}`);
        if (error) throw error;
        const baseSalary = profile.basic_salary || 0;
        const shiftHours = profile.shift_type || 8; // افتراض 8 ساعات شفت
        const hourlyRate = profile.hourly_rate || (baseSalary / (daysInMonth * shiftHours)); // حساب معدل الساعة إذا لم يكن محددًا
        let workDays = attendance?.length || 0;
        let totalLateMinutes = 0;
        let totalOvertimeMinutes = 0;
        // حساب التأخير والإضافي
        attendance?.forEach(record => {
            if (record.check_in) {
                const checkInTime = new Date(`1970-01-01T${record.check_in}`);
                const standardTime = new Date('1970-01-01T09:00:00'); // افتراض وقت الحضور القياسي 9:00 ص
                const lateMins = (checkInTime - standardTime) / (1000 * 60);
                if (lateMins > 0) {
                    totalLateMinutes += lateMins;
                }
            }
            if (record.check_in && record.check_out) {
                const inTime = new Date(`1970-01-01T${record.check_in}`);
                const outTime = new Date(`1970-01-01T${record.check_out}`);
                const actualHours = (outTime - inTime) / (1000 * 60 * 60);
                if (actualHours > shiftHours) {
                    totalOvertimeMinutes += (actualHours - shiftHours) * 60;
                }
            }
            // جمع التأخير والعمل الإضافي من الحقول المخزنة في قاعدة البيانات إن وجدت
            totalLateMinutes += record.late_minutes || 0;
            totalOvertimeMinutes += record.overtime_minutes || 0;
        });
        const lateDeduction = (totalLateMinutes / 60) * hourlyRate;
        const overtimeBonus = (totalOvertimeMinutes / 60) * hourlyRate;
        const expectedSalary = (workDays * shiftHours * hourlyRate) - lateDeduction + overtimeBonus;
        document.getElementById('workDaysCount').textContent = workDays;
        document.getElementById('lateMinutesCount').textContent = `${Math.round(totalLateMinutes)} دقيقة`;
        document.getElementById('expectedLateDeduction').textContent = `${lateDeduction.toFixed(2)} ج.م`;
        document.getElementById('overtimeMinutesCount').textContent = `${Math.round(totalOvertimeMinutes)} دقيقة`;
        document.getElementById('expectedOvertimeBonus').textContent = `${overtimeBonus.toFixed(2)} ج.م`;
        document.getElementById('expectedTotalSalary').textContent = `${expectedSalary.toFixed(2)} ج.م`;
        // تحديث عرض معلومات الشيفت والمعدل الساعة
        document.getElementById('shiftType').textContent = `${shiftHours} ساعات`;
        document.getElementById('hourlyRate').textContent = `${hourlyRate.toFixed(2)} ج.م`;
    } catch (error) {
        console.error("Error calculating expected salary:", error);
        // من الأفضل عرض رسالة خطأ في UI بدلاً من السكوت
        document.getElementById('expectedTotalSalary').textContent = "خطأ في الحساب";
        document.getElementById('workDaysCount').textContent = "0";
        document.getElementById('lateMinutesCount').textContent = "0 دقيقة";
        document.getElementById('expectedLateDeduction').textContent = "0 ج.م";
        document.getElementById('overtimeMinutesCount').textContent = "0 دقيقة";
        document.getElementById('expectedOvertimeBonus').textContent = "0 ج.م";
    }
}

// دالة تحديث الواجهة
export function updateDateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ar-EG');
    const dateStr = now.toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    document.getElementById('currentTime').textContent = timeStr;
    document.getElementById('currentDate').textContent = dateStr;
}

// Show notification
export function showNotification(text, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    notificationText.textContent = text;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}