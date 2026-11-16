let currentUser = null;

async function enforceStudentSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = "index.html";
        return null;
    }

    const { data: roleRow } = await supabaseClient
        .from("user_roles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

    if (!roleRow || roleRow.role !== "student") {
        window.location.href = "index.html";
        return null;
    }

    const { data: activeRow } = await supabaseClient
        .from("students")
        .select("matric_number")
        .eq("matric_number", roleRow.matric_or_admin_id)
        .maybeSingle();

    if (!activeRow) {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
        return null;
    }

    return {
        userId: session.user.id,
        fullName: roleRow.full_name,
        matricNumber: roleRow.matric_or_admin_id,
        phoneNumber: roleRow.phone_number,
        department: roleRow.department
    };
}

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
}

function startAccountCloseFlow() {
    document.getElementById("initiateCloseBtn").classList.add("hidden");
    document.getElementById("doubleCheckBox").classList.remove("hidden");
}

function cancelAccountCloseFlow() {
    document.getElementById("doubleCheckBox").classList.add("hidden");
    document.getElementById("initiateCloseBtn").classList.remove("hidden");
}

async function confirmPermanentClosure() {
    const secondConfirm = confirm(
        "FINAL DOUBLE CHECK: Do you really want to permanently deactivate your account? Once deactivated, it cannot be recovered."
    );
    if (!secondConfirm) {
        cancelAccountCloseFlow();
        return;
    }

    const { data: student } = await supabaseClient
        .from("students")
        .select("*")
        .eq("matric_number", currentUser.matricNumber)
        .maybeSingle();

    if (student) {
        await supabaseClient.from("deleted_accounts").insert({
            full_name: student.full_name,
            matric_number: student.matric_number,
            phone_number: student.phone_number,
            department: student.department,
            registered_at: student.registered_at,
            deleted_at: new Date().toLocaleString()
        });

        await supabaseClient
            .from("students")
            .delete()
            .eq("matric_number", currentUser.matricNumber);
    }

    await supabaseClient.auth.signOut();
    alert("Your account has been permanently deactivated and moved to Deleted Accounts.");
    window.location.href = "index.html";
}

function sessionMatchesStudentDept(session, studentDept) {
    if (Array.isArray(session.target_departments)) {
        return session.target_departments.includes("General") || session.target_departments.includes(studentDept);
    }
    return session.target_department === "General" || session.target_department === studentDept;
}

async function renderAvailableSessions() {
    const container = document.getElementById("availableSessionsList");
    container.innerHTML = "<p>Loading sessions...</p>";

    const { data: sessions } = await supabaseClient
        .from("attendance_sessions")
        .select("*")
        .eq("is_frozen", false)
        .order("created_at", { ascending: false });

    const { data: records } = await supabaseClient
        .from("attendance_records")
        .select("session_id, is_frozen")
        .eq("matric_number", currentUser.matricNumber);

    container.innerHTML = "";
    const eligibleSessions = (sessions || []).filter(s =>
        sessionMatchesStudentDept(s, currentUser.department)
    );

    if (eligibleSessions.length === 0) {
        container.innerHTML = "<p>No active attendance sessions available for your department right now.</p>";
        return;
    }

    const now = new Date();

    eligibleSessions.forEach(session => {
        const alreadyMarked = (records || []).some(
            r => r.session_id === session.id && !r.is_frozen
        );

        const deadline = new Date(`${session.session_date}T${session.end_time}`);
        const isExpired = now > deadline;
        const targetLabel = Array.isArray(session.target_departments)
            ? session.target_departments.join(", ")
            : session.target_department;

        const card = document.createElement("div");
        card.className = "session-item";

        let actionButton = "";
        if (alreadyMarked) {
            actionButton = `<button class="btn-success" disabled>✔ Attendance Marked</button>`;
        } else if (isExpired) {
            actionButton = `<button class="btn-secondary" disabled>Session Closed (Time Elapsed)</button>`;
        } else {
            actionButton = `<button class="btn-primary" onclick="markAttendance('${session.id}')">Mark Present</button>`;
        }

        card.innerHTML = `
            <div>
                <span class="badge ${isExpired ? 'badge-closed' : 'badge-open'}">
                    ${isExpired ? 'Closed' : 'Open'} • ${targetLabel}
                </span>
                <h3 style="margin-top: 0.5rem;">${session.subject}</h3>
                <p style="font-size: 0.85rem; color: #475569;">Date: ${session.session_date}</p>
                <p style="font-size: 0.85rem; color: #475569;">Window: ${session.start_time} - ${session.end_time}</p>
            </div>
            ${actionButton}
        `;
        container.appendChild(card);
    });
}

async function markAttendance(sessionId) {
    const { data: session } = await supabaseClient
        .from("attendance_sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();

    if (!session || session.is_frozen) {
        alert("This attendance session is currently unavailable or frozen by the admin.");
        renderAvailableSessions();
        return;
    }

    const now = new Date();
    const deadline = new Date(`${session.session_date}T${session.end_time}`);
    if (now > deadline) {
        alert("Sorry, the time window for this attendance has closed.");
        renderAvailableSessions();
        return;
    }

    const timestamp = now.toLocaleString();
    const targetLabel = Array.isArray(session.target_departments)
        ? session.target_departments.join(", ")
        : session.target_department;

    const { error } = await supabaseClient.from("attendance_records").insert({
        record_id: "REC_" + Date.now() + "_" + currentUser.matricNumber,
        session_id: session.id,
        subject: session.subject,
        target_department: targetLabel,
        session_date: session.session_date,
        student_name: currentUser.fullName,
        matric_number: currentUser.matricNumber,
        phone_number: currentUser.phoneNumber,
        student_department: currentUser.department,
        marked_at: timestamp,
        is_frozen: false
    });

    if (error) {
        alert(error.code === "23505"
            ? "You have already marked attendance for this session."
            : "Could not mark attendance: " + error.message);
        return;
    }

    document.getElementById("formspreeStatus").textContent =
        `Attendance for ${session.subject} marked at ${timestamp}.`;

    renderAvailableSessions();
    renderMyHistory();
}

async function renderMyHistory() {
    const { data: sessions } = await supabaseClient
        .from("attendance_sessions")
        .select("id, is_frozen");

    const { data: records } = await supabaseClient
        .from("attendance_records")
        .select("*")
        .eq("matric_number", currentUser.matricNumber);

    const activeSessionMap = new Map((sessions || []).map(s => [s.id, s]));

    const visibleRecords = (records || []).filter(r => {
        if (r.is_frozen) return false;
        const parentSession = activeSessionMap.get(r.session_id);
        if (!parentSession || parentSession.is_frozen) return false;
        return true;
    });

    document.getElementById("totalMarkedCount").textContent = visibleRecords.length;

    const tbody = document.getElementById("myAttendanceHistoryBody");
    tbody.innerHTML = "";

    if (visibleRecords.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">You have no active marked attendance records.</td></tr>`;
        return;
    }

    visibleRecords.forEach((rec, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${rec.subject}</strong></td>
            <td>${rec.target_department}</td>
            <td>${rec.marked_at}</td>
            <td><span class="badge badge-open">Present</span></td>
        `;
        tbody.appendChild(row);
    });
}

function refreshStudentDashboard() {
    renderAvailableSessions();
    renderMyHistory();
}

(async function init() {
    currentUser = await enforceStudentSession();
    if (!currentUser) return;

    document.getElementById("displayStudentName").textContent = currentUser.fullName;
    document.getElementById("displayMatric").textContent = currentUser.matricNumber;
    document.getElementById("displayPhone").textContent = currentUser.phoneNumber;
    document.getElementById("displayDepartment").textContent = currentUser.department;

    refreshStudentDashboard();
})();