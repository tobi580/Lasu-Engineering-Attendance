const currentUser = JSON.parse(localStorage.getItem("lasu_current_user"));
if (!currentUser || currentUser.role !== "admin") {
    window.location.href = "index.html";
}

document.getElementById("adminWelcomeSub").textContent =
    `Signed in as ${currentUser.name || "Faculty Admin"} • Manage Sessions, Freeze/Delete Records & Registries`;

const PASSWORD_REVEAL_KEY = APP_CONFIG.PASSWORD_REVEAL_KEY;
const DELETED_ACCOUNT_DELETE_KEY = APP_CONFIG.DELETED_ACCOUNT_DELETE_KEY;
const ONE_HOUR_MS = 60 * 60 * 1000;

let passwordsUnlocked = false;
let deletedAccountDeleteUnlocked = false;
let activeFolderSessionId = null;

function switchAdminSection(sectionId) {
    ["createSection", "foldersSection", "registrySection", "deletedSection"].forEach(id => {
        document.getElementById(id).classList.add("hidden");
    });
    ["navCreate", "navFolders", "navRegistry", "navDeleted"].forEach(btnId => {
        document.getElementById(btnId).classList.remove("active");
    });

    document.getElementById(sectionId).classList.remove("hidden");

    if (sectionId === "createSection") {
        document.getElementById("navCreate").classList.add("active");
        renderAdminSessions();
    }
    if (sectionId === "foldersSection") {
        document.getElementById("navFolders").classList.add("active");
        closeFolder();
        renderFolders();
    }
    if (sectionId === "registrySection") {
        document.getElementById("navRegistry").classList.add("active");
        renderProtectedRegistry();
    }
    if (sectionId === "deletedSection") {
        document.getElementById("navDeleted").classList.add("active");
        renderDeletedAccounts();
    }
}

function handleGeneralCheckbox(generalBox) {
    if (generalBox.checked) {
        document.querySelectorAll(".specific-dept").forEach(cb => {
            cb.checked = false;
        });
    }
}

function handleSpecificDeptCheckbox() {
    const anySpecificChecked = Array.from(document.querySelectorAll(".specific-dept")).some(cb => cb.checked);
    const generalBox = document.querySelector('.dept-checkbox[value="General"]');
    if (anySpecificChecked && generalBox) {
        generalBox.checked = false;
    }
}

function getSelectedDepartments() {
    return Array.from(document.querySelectorAll(".dept-checkbox:checked")).map(cb => cb.value);
}

function formatDepartmentsLabel(session) {
    if (Array.isArray(session.target_departments) && session.target_departments.length > 0) {
        return session.target_departments.join(", ");
    }
    return session.target_department || "General";
}

// 1. Create Attendance Session
document.getElementById("createSessionForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const subject = document.getElementById("fixedSubject").value;
    const selectedDepartments = getSelectedDepartments();
    const date = document.getElementById("sessionDate").value;
    const startTime = document.getElementById("startTime").value;
    const endTime = document.getElementById("endTime").value;

    if (selectedDepartments.length === 0) {
        alert("Please select at least one target department (or General).");
        return;
    }

    if (endTime <= startTime) {
        alert("End time must be later than start time.");
        return;
    }

    const newSession = {
        id: "SES_" + Date.now(),
        subject,
        target_departments: selectedDepartments,
        target_department: selectedDepartments.includes("General")
            ? "General"
            : selectedDepartments.join(", "),
        session_date: date,
        start_time: startTime,
        end_time: endTime,
        is_frozen: false,
        google_backed_up: false,
        created_at: new Date().toLocaleString()
    };

    const { error } = await supabaseClient.from("attendance_sessions").insert(newSession);
    if (error) {
        alert("Failed to create session: " + error.message);
        return;
    }

    this.reset();
    renderAdminSessions();
    alert("Attendance session saved! Subject, Date, and Target Departments are locked; only the time can be modified.");
});

async function renderAdminSessions() {
    const { data: sessions } = await supabaseClient
        .from("attendance_sessions")
        .select("*")
        .order("created_at", { ascending: false });

    const container = document.getElementById("adminSessionsList");
    container.innerHTML = "";

    if (!sessions || sessions.length === 0) {
        container.innerHTML = "<p>No attendance sessions created yet.</p>";
        return;
    }

    sessions.forEach(session => {
        const deptLabel = formatDepartmentsLabel(session);
        const card = document.createElement("div");
        card.className = `session-item ${session.is_frozen ? "session-frozen" : ""}`;
        card.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                    <span class="badge badge-lock">🔒 Subject, Dept & Date Locked</span>
                    <span class="badge ${session.is_frozen ? "badge-frozen" : "badge-open"}">
                        ${session.is_frozen ? "❄ Frozen (Hidden from Students)" : "● Active"}
                    </span>
                </div>
                <h3 style="margin-top: 0.5rem;">${session.subject}</h3>
                <p style="font-size: 0.85rem;"><strong>Target:</strong> ${deptLabel}</p>
                <p style="font-size: 0.85rem;"><strong>Date:</strong> ${session.session_date}</p>
                ${session.google_backed_up ? `<p style="font-size: 0.8rem; color: #16a34a;">☁ Backed up (${session.backed_up_at})</p>` : ""}
            </div>

            <div style="background: #ffffff; padding: 0.65rem; border-radius: 6px; border: 1px solid #cbd5e1;">
                <label style="font-size: 0.8rem;">Modify Time Window Only:</label>
                <div style="display: flex; gap: 0.4rem; margin-top: 0.3rem;">
                    <input type="time" id="start_${session.id}" value="${session.start_time}" style="padding: 0.35rem; width: 100%;">
                    <input type="time" id="end_${session.id}" value="${session.end_time}" style="padding: 0.35rem; width: 100%;">
                </div>
                <button class="btn-primary" style="width: 100%; margin-top: 0.5rem; padding: 0.45rem;" onclick="updateSessionTime('${session.id}')">
                    Update Time
                </button>
            </div>

            <div style="display: flex; gap: 0.5rem;">
                <button class="btn-warning" style="flex: 1;" onclick="toggleFreezeSession('${session.id}', ${!session.is_frozen})">
                    ${session.is_frozen ? "Unfreeze" : "Freeze"}
                </button>
                <button class="btn-danger" style="flex: 1;" onclick="deleteSessionAndRecords('${session.id}')">
                    Delete
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function updateSessionTime(sessionId) {
    const newStart = document.getElementById(`start_${sessionId}`).value;
    const newEnd = document.getElementById(`end_${sessionId}`).value;

    if (newEnd <= newStart) {
        alert("End time must be after start time.");
        return;
    }

    const { error } = await supabaseClient
        .from("attendance_sessions")
        .update({ start_time: newStart, end_time: newEnd, google_backed_up: false })
        .eq("id", sessionId);

    if (error) {
        alert("Update failed: " + error.message);
        return;
    }

    alert("Attendance time window updated successfully.");
    renderAdminSessions();
}

async function toggleFreezeSession(sessionId, nextFrozenState) {
    await supabaseClient
        .from("attendance_sessions")
        .update({ is_frozen: nextFrozenState })
        .eq("id", sessionId);

    renderAdminSessions();
    renderFolders();
    if (activeFolderSessionId === sessionId) {
        openFolder(sessionId);
    }
}

async function deleteSessionAndRecords(sessionId) {
    const confirmed = confirm(
        "Are you sure you want to delete this attendance folder/session? All student attendance entries marked under it will also be permanently deleted and removed from student screens."
    );
    if (!confirmed) return;

    await supabaseClient.from("attendance_records").delete().eq("session_id", sessionId);
    await supabaseClient.from("attendance_sessions").delete().eq("id", sessionId);

    if (activeFolderSessionId === sessionId) {
        closeFolder();
    }
    renderAdminSessions();
    renderFolders();
}

// 2. Render Folders
async function renderFolders() {
    const { data: sessions } = await supabaseClient
        .from("attendance_sessions")
        .select("*")
        .order("created_at", { ascending: false });

    const { data: records } = await supabaseClient
        .from("attendance_records")
        .select("session_id");

    const searchInput = document.getElementById("folderSearchInput");
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

    const container = document.getElementById("foldersContainer");
    container.innerHTML = "";

    const allSessions = sessions || [];
    const filteredSessions = allSessions.filter(s => s.subject.toLowerCase().includes(query));

    if (allSessions.length === 0) {
        container.innerHTML = "<p>No attendance folders available yet.</p>";
        return;
    }

    if (filteredSessions.length === 0) {
        container.innerHTML = `<p>No attendance folders match course name "<strong>${searchInput.value}</strong>".</p>`;
        return;
    }

    filteredSessions.forEach(session => {
        const count = (records || []).filter(r => r.session_id === session.id).length;
        const deptLabel = formatDepartmentsLabel(session);
        const folder = document.createElement("div");
        folder.className = `folder-card ${session.is_frozen ? "folder-frozen" : ""}`;

        folder.innerHTML = `
            <div onclick="openFolder('${session.id}')" style="cursor: pointer;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 1.8rem;">${session.is_frozen ? "🧊" : "📁"}</span>
                    <span class="badge ${session.is_frozen ? "badge-frozen" : "badge-open"}">
                        ${session.is_frozen ? "Frozen" : "Active"}
                    </span>
                </div>
                <h3 style="margin-top: 0.4rem;">${session.subject}</h3>
                <p style="font-size: 0.85rem; color: #475569;">Target: <strong>${deptLabel}</strong></p>
                <p style="font-size: 0.85rem; color: #475569;">Date: ${session.session_date} (${session.start_time} - ${session.end_time})</p>
                <p style="margin-top: 0.5rem; font-weight: 700; color: #0f294a;">${count} Student(s) Recorded</p>
            </div>

            <div style="display: flex; gap: 0.5rem; margin-top: 0.4rem;">
                <button class="btn-primary" style="flex: 1; margin-top: 0; padding: 0.45rem;" onclick="openFolder('${session.id}')">Open</button>
                <button class="btn-warning" style="padding: 0.45rem 0.7rem;" onclick="toggleFreezeSession('${session.id}', ${!session.is_frozen})">
                    ${session.is_frozen ? "Unfreeze" : "Freeze"}
                </button>
                <button class="btn-danger" style="padding: 0.45rem 0.7rem;" onclick="deleteSessionAndRecords('${session.id}')">
                    Delete
                </button>
            </div>
        `;
        container.appendChild(folder);
    });
}

async function openFolder(sessionId) {
    activeFolderSessionId = sessionId;
    const studentSearchInput = document.getElementById("folderStudentSearchInput");
    if (studentSearchInput) studentSearchInput.value = "";

    document.getElementById("folderGridView").classList.add("hidden");
    document.getElementById("folderDetailView").classList.remove("hidden");

    await renderFolderStudentTable();
}

function filterActiveFolderStudents() {
    if (activeFolderSessionId) {
        renderFolderStudentTable();
    }
}

async function renderFolderStudentTable() {
    const { data: session } = await supabaseClient
        .from("attendance_sessions")
        .select("*")
        .eq("id", activeFolderSessionId)
        .maybeSingle();

    if (!session) return;

    const freezeBtn = document.getElementById("folderFreezeToggleBtn");
    freezeBtn.textContent = session.is_frozen ? "Unfreeze Folder" : "Freeze Folder";

    const { data: allSessionRecords } = await supabaseClient
        .from("attendance_records")
        .select("*")
        .eq("session_id", activeFolderSessionId);

    const searchInput = document.getElementById("folderStudentSearchInput");
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

    const list = allSessionRecords || [];
    const filteredRecords = list.filter(rec =>
        rec.student_name.toLowerCase().includes(query) ||
        rec.matric_number.toLowerCase().includes(query)
    );

    const deptLabel = formatDepartmentsLabel(session);
    document.getElementById("folderTitle").textContent = `LASU Engineering Attendance — ${session.subject}`;
    document.getElementById("folderMeta").textContent =
        `Departments: ${deptLabel} | Date: ${session.session_date} | Window: ${session.start_time} - ${session.end_time} | Status: ${session.is_frozen ? "FROZEN" : "ACTIVE"} | Showing: ${filteredRecords.length} of ${list.length}`;

    const tbody = document.getElementById("folderTableBody");
    tbody.innerHTML = "";

    if (filteredRecords.length === 0) {
        const msg = list.length === 0
            ? "No students have marked attendance for this session yet."
            : "No student records match that name or matric number.";
        tbody.innerHTML = `<tr><td colspan="8">${msg}</td></tr>`;
        return;
    }

    filteredRecords.forEach((rec, idx) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${idx + 1}</td>
            <td><strong>${rec.student_name}</strong></td>
            <td>${rec.matric_number}</td>
            <td>${rec.phone_number || "-"}</td>
            <td>${rec.student_department}</td>
            <td>${rec.marked_at}</td>
            <td>
                <span class="badge ${rec.is_frozen || session.is_frozen ? "badge-frozen" : "badge-open"}">
                    ${rec.is_frozen || session.is_frozen ? "Frozen" : "Active"}
                </span>
            </td>
            <td class="no-export" style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                <button class="btn-warning" style="padding: 0.3rem 0.6rem; font-size: 0.78rem;" onclick="toggleFreezeStudentRecord('${rec.record_id}', ${!rec.is_frozen})">
                    ${rec.is_frozen ? "Unfreeze" : "Freeze"}
                </button>
                <button class="btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.78rem;" onclick="deleteStudentRecord('${rec.record_id}')">
                    Delete
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function toggleFreezeStudentRecord(recordId, nextFrozen) {
    await supabaseClient
        .from("attendance_records")
        .update({ is_frozen: nextFrozen })
        .eq("record_id", recordId);

    if (activeFolderSessionId) renderFolderStudentTable();
}

async function deleteStudentRecord(recordId) {
    if (!confirm("Delete this student's attendance record? It will also be removed from the student's screen.")) {
        return;
    }

    await supabaseClient.from("attendance_records").delete().eq("record_id", recordId);
    if (activeFolderSessionId) renderFolderStudentTable();
    renderFolders();
}

function toggleActiveFolderFreeze() {
    if (activeFolderSessionId) {
        renderFolderStudentTable().then(() => {
            // Handled via session state
        });
        supabaseClient
            .from("attendance_sessions")
            .select("is_frozen")
            .eq("id", activeFolderSessionId)
            .maybeSingle()
            .then(({ data }) => {
                if (data) toggleFreezeSession(activeFolderSessionId, !data.is_frozen);
            });
    }
}

function deleteActiveFolder() {
    if (activeFolderSessionId) {
        deleteSessionAndRecords(activeFolderSessionId);
    }
}

function closeFolder() {
    activeFolderSessionId = null;
    document.getElementById("folderDetailView").classList.add("hidden");
    document.getElementById("folderGridView").classList.remove("hidden");
}

function downloadTableAsImage() {
    const element = document.getElementById("printableArea");
    html2canvas(element, { scale: 2 }).then(canvas => {
        const link = document.createElement("a");
        link.download = `attendance_${activeFolderSessionId || "sheet"}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
}

function downloadTableAsPDF() {
    const element = document.getElementById("printableArea");
    html2canvas(element, { scale: 2 }).then(canvas => {
        const imgData = canvas.toDataURL("image/png");
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, "PNG", 0, 10, pdfWidth, pdfHeight);
        pdf.save(`attendance_${activeFolderSessionId || "sheet"}.pdf`);
    });
}

// 3. Student Registration Table (TObilobA2026)
function unlockStudentPasswords() {
    const enteredKey = document.getElementById("revealPassKeyInput").value;
    const msgEl = document.getElementById("passwordUnlockMsg");

    if (enteredKey === PASSWORD_REVEAL_KEY) {
        passwordsUnlocked = true;
        msgEl.className = "success-msg";
        msgEl.textContent = "Security key accepted. Student passwords are now visible.";
        document.getElementById("lockPassBtn").classList.remove("hidden");
        renderProtectedRegistry();
    } else {
        passwordsUnlocked = false;
        msgEl.className = "error-msg";
        msgEl.textContent = "Invalid security key. Student passwords remain hidden.";
    }
}

function lockStudentPasswords() {
    passwordsUnlocked = false;
    document.getElementById("revealPassKeyInput").value = "";
    document.getElementById("passwordUnlockMsg").textContent = "";
    document.getElementById("lockPassBtn").classList.add("hidden");
    renderProtectedRegistry();
}

async function renderProtectedRegistry() {
    const { data: students } = await supabaseClient
        .from("students")
        .select("*");

    const searchInput = document.getElementById("registrySearchInput");
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

    const tbody = document.getElementById("studentRegistryBody");
    tbody.innerHTML = "";

    const list = students || [];
    const filteredStudents = list.filter(student =>
        student.full_name.toLowerCase().includes(query) ||
        student.matric_number.toLowerCase().includes(query)
    );

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7">No active students registered yet.</td></tr>`;
        return;
    }

    if (filteredStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7">No students match "${searchInput.value}".</td></tr>`;
        return;
    }

    filteredStudents.forEach((student, index) => {
        const passwordCell = passwordsUnlocked
            ? `<strong style="color: #0f294a; font-family: monospace;">${student.password}</strong>`
            : `<span class="badge badge-lock">🔒 Locked (Enter Key)</span>`;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${student.full_name}</strong></td>
            <td>${student.matric_number}</td>
            <td>${student.phone_number}</td>
            <td>${student.department}</td>
            <td>${passwordCell}</td>
            <td>${student.registered_at}</td>
        `;
        tbody.appendChild(row);
    });
}

// 4. Deleted Accounts Table (Passcode-Gated Delete: "TOBIloba2026")
function unlockDeletedAccountDelete() {
    const enteredPasscode = document.getElementById("deletedPasscodeInput").value;
    const msgEl = document.getElementById("deletedPasscodeMsg");

    if (enteredPasscode === DELETED_ACCOUNT_DELETE_KEY) {
        deletedAccountDeleteUnlocked = true;
        msgEl.className = "success-msg";
        msgEl.textContent = "Passcode verified. You can now delete archived deleted account records.";
        document.getElementById("lockDeletedBtn").classList.remove("hidden");
        renderDeletedAccounts();
    } else {
        deletedAccountDeleteUnlocked = false;
        msgEl.className = "error-msg";
        msgEl.textContent = "Invalid passcode. Delete controls remain locked.";
        renderDeletedAccounts();
    }
}

function lockDeletedAccountDelete() {
    deletedAccountDeleteUnlocked = false;
    document.getElementById("deletedPasscodeInput").value = "";
    document.getElementById("deletedPasscodeMsg").textContent = "";
    document.getElementById("lockDeletedBtn").classList.add("hidden");
    renderDeletedAccounts();
}

async function deleteArchivedAccount(id, fullName, matricNumber) {
    if (!deletedAccountDeleteUnlocked) {
        alert("Enter the passcode first to unlock deleted account removal.");
        return;
    }

    const confirmed = confirm(
        `Permanently remove the deleted account record for ${fullName} (${matricNumber}) from Deleted Accounts?`
    );
    if (!confirmed) return;

    await supabaseClient.from("deleted_accounts").delete().eq("id", id);
    renderDeletedAccounts();
}

async function renderDeletedAccounts() {
    const { data: deletedAccounts } = await supabaseClient
        .from("deleted_accounts")
        .select("*");

    const tbody = document.getElementById("deletedAccountsBody");
    tbody.innerHTML = "";

    const list = deletedAccounts || [];
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8">No accounts have been deleted yet.</td></tr>`;
        return;
    }

    list.forEach((acc, index) => {
        const actionCell = deletedAccountDeleteUnlocked
            ? `<button class="btn-danger" style="padding: 0.3rem 0.65rem; font-size: 0.78rem;" onclick="deleteArchivedAccount('${acc.id}', '${acc.full_name.replace(/'/g, "\\'")}', '${acc.matric_number}')">Delete Record</button>`
            : `<span class="badge badge-lock">🔒 Locked</span>`;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${acc.full_name}</strong></td>
            <td>${acc.matric_number}</td>
            <td>${acc.phone_number}</td>
            <td>${acc.department}</td>
            <td>${acc.registered_at}</td>
            <td><span class="badge badge-closed">${acc.deleted_at}</span></td>
            <td>${actionCell}</td>
        `;
        tbody.appendChild(row);
    });
}

// 1-Hour Post-Close Automatic Google Backup
async function checkAndAutoBackupClosedSessions() {
    if (!APP_CONFIG.GOOGLE_BACKUP_WEBHOOK_URL) return;

    const { data: sessions } = await supabaseClient
        .from("attendance_sessions")
        .select("*")
        .eq("google_backed_up", false);

    if (!sessions || sessions.length === 0) return;

    const now = Date.now();
    for (const session of sessions) {
        const endTs = new Date(`${session.session_date}T${session.end_time}`).getTime();
        if (isNaN(endTs) || now < endTs + ONE_HOUR_MS) continue;

        const { data: sessionRecords } = await supabaseClient
            .from("attendance_records")
            .select("*")
            .eq("session_id", session.id);

        try {
            await fetch(APP_CONFIG.GOOGLE_BACKUP_WEBHOOK_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify({
                    sessionId: session.id,
                    subject: session.subject,
                    targetDepartment: formatDepartmentsLabel(session),
                    date: session.session_date,
                    startTime: session.start_time,
                    endTime: session.end_time,
                    records: sessionRecords || []
                })
            });

            const backedUpAt = new Date().toLocaleString();
            await supabaseClient
                .from("attendance_sessions")
                .update({ google_backed_up: true, backed_up_at: backedUpAt })
                .eq("id", session.id);
        } catch (err) {
            console.error("Auto-backup failed, will retry:", err);
        }
    }
}

renderAdminSessions();
checkAndAutoBackupClosedSessions();
setInterval(checkAndAutoBackupClosedSessions, 60 * 1000);