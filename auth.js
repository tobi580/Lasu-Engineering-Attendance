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

function matricToAuthEmail(matricOrId) {
    const clean = matricOrId.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    return `${clean}@portal.lasu-eng.local`;
}

// Student Sign-Up Handler (Supabase Auth + Students & Roles Tables)
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

    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email: matricToAuthEmail(matricNumber),
        password
    });

    if (authError || !authData.user) {
        signupMsg.textContent = authError ? authError.message : "Registration failed.";
        return;
    }

    const registeredAt = new Date().toLocaleString();

    const { error: studentError } = await supabaseClient.from("students").insert({
        full_name: fullName,
        matric_number: matricNumber,
        matric_last3: newLast3,
        phone_number: phoneNumber,
        department,
        registered_at: registeredAt
    });

    if (studentError) {
        signupMsg.textContent = "Registration blocked: " + studentError.message;
        return;
    }

    const { error: roleError } = await supabaseClient.from("user_roles").insert({
        user_id: authData.user.id,
        role: "student",
        matric_or_admin_id: matricNumber,
        full_name: fullName,
        phone_number: phoneNumber,
        department
    });

    if (roleError) {
        signupMsg.textContent = "Profile setup failed: " + roleError.message;
        return;
    }

    window.location.href = "student.html";
});

// Login Handler: Confirms Name + Matric/Admin ID + Password via Supabase Auth
document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const loginName = document.getElementById("loginName").value.trim().toUpperCase();
    const loginMatric = document.getElementById("loginMatric").value.trim().toUpperCase();
    const loginPassword = document.getElementById("loginPassword").value;
    const loginError = document.getElementById("loginError");

    loginError.textContent = "";

    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email: matricToAuthEmail(loginMatric),
        password: loginPassword
    });

    if (authError || !authData.user) {
        loginError.textContent = "Invalid Matric/Admin ID or password.";
        return;
    }

    const { data: roleRow } = await supabaseClient
        .from("user_roles")
        .select("*")
        .eq("user_id", authData.user.id)
        .maybeSingle();

    if (!roleRow || roleRow.full_name.trim().toUpperCase() !== loginName || roleRow.matric_or_admin_id.trim().toUpperCase() !== loginMatric) {
        await supabaseClient.auth.signOut();
        loginError.textContent = "Full Name and Matric/Admin ID do not match this account.";
        return;
    }

    window.location.href = roleRow.role === "admin" ? "admin.html" : "student.html";
});