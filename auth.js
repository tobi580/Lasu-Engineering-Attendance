const DEFAULT_ADMIN_PRESET = {
    name: "FACULTY ADMIN",
    matric: "ADMIN",
    phone: "00000000000",
    password: "admin123"
};

function switchAuthTab(tab) {
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    const loginTabBtn = document.getElementById("loginTabBtn");
    const signupTabBtn = document.getElementById("signupTabBtn");

    if (tab === "login") {
        loginForm.classList.remove("hidden");
        signupForm.classList.add("hidden");
        loginTabBtn.classList.add("active");
        signupTabBtn.classList.remove("active");
    } else {
        signupForm.classList.remove("hidden");
        loginForm.classList.add("hidden");
        signupTabBtn.classList.add("active");
        loginTabBtn.classList.remove("active");
    }
}

function fillAdminDemo() {
    document.getElementById("loginName").value = DEFAULT_ADMIN_PRESET.name;
    document.getElementById("loginMatric").value = DEFAULT_ADMIN_PRESET.matric;
    document.getElementById("loginPhone").value = DEFAULT_ADMIN_PRESET.phone;
    document.getElementById("loginPassword").value = DEFAULT_ADMIN_PRESET.password;
}

function normalizeNigerianPhone(rawPhone) {
    const digits = rawPhone.replace(/\D/g, "");
    if (digits.startsWith("234") && digits.length === 13) {
        return "0" + digits.slice(3);
    }
    return digits;
}

function isValidNigerianPhone(normalizedPhone) {
    return /^(070|080|081|090|091)\d{8}$/.test(normalizedPhone);
}

// Sign-Up Handler (Supabase)
document.getElementById("signupForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const fullName = document.getElementById("fullName").value.trim().toUpperCase();
    const matricNumber = document.getElementById("matricNumber").value.trim().toUpperCase();
    const phoneNumber = normalizeNigerianPhone(document.getElementById("phoneNumber").value.trim());
    const department = document.getElementById("department").value;
    const password = document.getElementById("signupPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const signupMsg = document.getElementById("signupMsg");

    signupMsg.textContent = "";

    if (!matricNumber || matricNumber.length < 3) {
        signupMsg.textContent = "Matric number must be at least 3 characters.";
        return;
    }

    if (!isValidNigerianPhone(phoneNumber)) {
        signupMsg.textContent = "Enter a valid Nigerian phone number (e.g., 08012345678 or +2348012345678).";
        return;
    }

    if (password !== confirmPassword) {
        signupMsg.textContent = "Passwords do not match. Please confirm your password.";
        return;
    }

    const newLast3 = matricNumber.slice(-3);

    const { data: existingMatric } = await supabaseClient
        .from("students")
        .select("matric_number")
        .eq("matric_number", matricNumber)
        .maybeSingle();

    if (existingMatric) {
        signupMsg.textContent = "This Matric Number is already registered to an active account.";
        return;
    }

    const { data: existingPhone } = await supabaseClient
        .from("students")
        .select("phone_number")
        .eq("phone_number", phoneNumber)
        .maybeSingle();

    if (existingPhone) {
        signupMsg.textContent = "This phone number is already in use by an active account.";
        return;
    }

    const { data: existingLast3 } = await supabaseClient
        .from("students")
        .select("matric_last3")
        .eq("matric_last3", newLast3)
        .maybeSingle();

    if (existingLast3) {
        signupMsg.textContent = `Registration blocked: Another active student already uses a matric number ending with '${newLast3}'.`;
        return;
    }

    const newStudent = {
        full_name: fullName,
        matric_number: matricNumber,
        matric_last3: newLast3,
        phone_number: phoneNumber,
        department,
        password,
        registered_at: new Date().toLocaleString()
    };

    const { error } = await supabaseClient.from("students").insert(newStudent);
    if (error) {
        signupMsg.textContent = "Registration failed: " + error.message;
        return;
    }

    localStorage.setItem("lasu_current_user", JSON.stringify({
        role: "student",
        fullName: newStudent.full_name,
        matricNumber: newStudent.matric_number,
        phoneNumber: newStudent.phone_number,
        department: newStudent.department
    }));

    window.location.href = "student.html";
});

// Login Handler (Supports Co-Admins on Any Phone + Students)
document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const loginName = document.getElementById("loginName").value.trim().toUpperCase();
    const loginMatric = document.getElementById("loginMatric").value.trim().toUpperCase();
    const loginPhone = normalizeNigerianPhone(document.getElementById("loginPhone").value.trim());
    const loginPassword = document.getElementById("loginPassword").value;
    const loginError = document.getElementById("loginError");

    loginError.textContent = "";

    // 1. Check Supabase admins table (allows you on phone or another co-admin)
    const { data: adminMatch } = await supabaseClient
        .from("admins")
        .select("*")
        .eq("admin_id", loginMatric)
        .eq("full_name", loginName)
        .eq("phone_number", loginPhone)
        .eq("password_plain", loginPassword)
        .maybeSingle();

    if (adminMatch) {
        localStorage.setItem("lasu_current_user", JSON.stringify({
            role: "admin",
            name: adminMatch.full_name,
            adminId: adminMatch.admin_id
        }));
        window.location.href = "admin.html";
        return;
    }

    // 2. Check active students
    const { data: student } = await supabaseClient
        .from("students")
        .select("*")
        .eq("matric_number", loginMatric)
        .eq("full_name", loginName)
        .eq("phone_number", loginPhone)
        .maybeSingle();

    if (!student) {
        const { data: wasDeleted } = await supabaseClient
            .from("deleted_accounts")
            .select("matric_number")
            .or(`matric_number.eq.${loginMatric},phone_number.eq.${loginPhone}`)
            .maybeSingle();

        loginError.textContent = wasDeleted
            ? "This account was permanently deactivated and cannot be recovered."
            : "No active student or admin matches that Name, ID/Matric, and Phone Number.";
        return;
    }

    if (student.password !== loginPassword) {
        loginError.textContent = "Incorrect password. Use 'Forgot Password?' to reset it.";
        return;
    }

    localStorage.setItem("lasu_current_user", JSON.stringify({
        role: "student",
        fullName: student.full_name,
        matricNumber: student.matric_number,
        phoneNumber: student.phone_number,
        department: student.department
    }));
    window.location.href = "student.html";
});

// Forgot Password Modal Controls
function openForgotModal() {
    document.getElementById("fpMessage").textContent = "";
    document.getElementById("fpMessage").className = "error-msg";
    document.getElementById("forgotForm").reset();
    document.getElementById("forgotModal").classList.remove("hidden");
}

function closeForgotModal() {
    document.getElementById("forgotModal").classList.add("hidden");
}

document.getElementById("forgotForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const fpName = document.getElementById("fpName").value.trim().toUpperCase();
    const fpMatric = document.getElementById("fpMatric").value.trim().toUpperCase();
    const fpPhone = normalizeNigerianPhone(document.getElementById("fpPhone").value.trim());
    const newPass = document.getElementById("fpNewPassword").value;
    const confirmPass = document.getElementById("fpConfirmPassword").value;
    const fpMessage = document.getElementById("fpMessage");

    if (newPass !== confirmPass) {
        fpMessage.className = "error-msg";
        fpMessage.textContent = "New passwords do not match.";
        return;
    }

    const { data: student } = await supabaseClient
        .from("students")
        .select("id")
        .eq("full_name", fpName)
        .eq("matric_number", fpMatric)
        .eq("phone_number", fpPhone)
        .maybeSingle();

    if (!student) {
        fpMessage.className = "error-msg";
        fpMessage.textContent = "Verification failed: Name, Matric Number, and Phone Number do not match any active account.";
        return;
    }

    const { error } = await supabaseClient
        .from("students")
        .update({ password: newPass })
        .eq("id", student.id);

    if (error) {
        fpMessage.className = "error-msg";
        fpMessage.textContent = "Could not update password: " + error.message;
        return;
    }

    fpMessage.className = "success-msg";
    fpMessage.textContent = "Password updated successfully! You can now log in.";
    setTimeout(() => closeForgotModal(), 1400);
});