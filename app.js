
const STORAGE_KEY = "peopledesk_employees_v1";

let employees = loadEmployees();
let detailEmployeeId = null;

const $ = (id) => document.getElementById(id);

const fields = [
    "nik",
    "name",
    "gender",
    "birthPlace",
    "birthDate",
    "religion",
    "office",
    "phone",
    "email",
    "address",
    "education",
    "department",
    "position",
    "joinDate",
    "status"
];

// ======================================
// PENYIMPANAN DATA
// ======================================

function loadEmployees() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error("Gagal membaca data lokal:", error);
        return [];
    }
}

function saveEmployees() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
}

// ======================================
// FUNGSI BANTUAN
// ======================================

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

function initials(name = "") {
    return name.trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0] || "")
        .join("")
        .toUpperCase() || "?";
}

function formatDate(value) {
    if (!value) return "—";

    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
}

function statusClass(status) {
    return status === "Tetap"
        ? "status-tetap"
        : status === "Kontrak"
            ? "status-kontrak"
            : "status-magang";
}

function showToast(message) {
    const toast = $("toast");

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2600);
}

// ======================================
// NAVIGASI HALAMAN
// ======================================

function showPage(page) {
    document.querySelectorAll(".page").forEach(el => {
        el.classList.remove("active");
    });

    const targetPage = $(page + "Page");

    if (!targetPage) return;

    targetPage.classList.add("active");

    document.querySelectorAll(".nav-item").forEach(el => {
        el.classList.toggle("active", el.dataset.page === page);
    });

    $("pageTitle").textContent =
        page === "dashboard" ? "Dashboard" : "Data Karyawan";

    $("sidebar").classList.remove("open");

    if (page === "employees") {
        renderEmployees();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
        showPage(btn.dataset.page);
    });
});

document.querySelectorAll("[data-go]").forEach(btn => {
    btn.addEventListener("click", () => {
        showPage(btn.dataset.go);
    });
});

$("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
});

// ======================================
// DASHBOARD
// ======================================

function renderDashboard() {
    $("totalEmployees").textContent = employees.length;

    $("permanentEmployees").textContent =
        employees.filter(e => e.status === "Tetap").length;

    $("contractEmployees").textContent =
        employees.filter(e => e.status === "Kontrak").length;

    $("departmentCount").textContent =
        new Set(
            employees
                .map(e => (e.department || "").trim().toLowerCase())
                .filter(Boolean)
        ).size;

    const latest = [...employees]
        .sort((a, b) =>
            (b.createdAt || "").localeCompare(a.createdAt || "")
        )
        .slice(0, 5);

    $("recentTable").innerHTML = latest.length
        ? latest.map(e => `
            <tr>
                <td>
                    <div class="person-cell">
                        <div class="person-avatar">
                            ${escapeHTML(initials(e.name))}
                        </div>
                        ${escapeHTML(e.name)}
                    </div>
                </td>
                <td>${escapeHTML(e.nik)}</td>
                <td>${escapeHTML(e.department)}</td>
                <td>${escapeHTML(e.position)}</td>
                <td>
                    <span class="badge-status ${statusClass(e.status)}">
                        ${escapeHTML(e.status)}
                    </span>
                </td>
            </tr>
        `).join("")
        : `
            <tr>
                <td colspan="5" style="text-align:center;padding:30px;color:#98a3b4">
                    Belum ada data karyawan.
                </td>
            </tr>
        `;
}

// ======================================
// DAFTAR KARYAWAN
// ======================================

function renderEmployees() {
    const search = $("searchInput").value.trim().toLowerCase();
    const dept = $("departmentFilter").value;
    const status = $("statusFilter").value;

    const filtered = employees.filter(e =>
        (e.name || "").toLowerCase().includes(search) &&
        (!dept || e.department === dept) &&
        (!status || e.status === status)
        ||
        (e.nik || "").toLowerCase().includes(search) &&
        (!dept || e.department === dept) &&
        (!status || e.status === status)
    );

    $("tableCount").textContent =
        `Menampilkan ${filtered.length} dari ${employees.length} karyawan`;

    $("employeeTable").innerHTML = filtered.map(e => `
        <tr>
            <td>
                <div class="person-cell">
                    <div class="person-avatar">
                        ${escapeHTML(initials(e.name))}
                    </div>
                    ${escapeHTML(e.name)}
                </div>
            </td>
            <td>${escapeHTML(e.nik)}</td>
            <td>${escapeHTML(e.department)}</td>
            <td>${escapeHTML(e.position)}</td>
            <td>${formatDate(e.joinDate)}</td>
            <td>
                <span class="badge-status ${statusClass(e.status)}">
                    ${escapeHTML(e.status)}
                </span>
            </td>
            <td>
                <div class="actions">
                    <button class="action-btn detail"
                        data-detail="${escapeHTML(e.id)}">
                        Detail Karyawan
                    </button>

                    <button class="action-btn"
                        data-edit="${escapeHTML(e.id)}">
                        Edit
                    </button>

                    <button class="action-btn delete"
                        data-delete="${escapeHTML(e.id)}">
                        Hapus
                    </button>
                </div>
            </td>
        </tr>
    `).join("");

    $("emptyState").hidden = filtered.length !== 0;

    $("employeeTable").parentElement.style.display =
        filtered.length ? "" : "none";

    updateDepartmentFilter();
}

function updateDepartmentFilter() {
    const select = $("departmentFilter");
    const current = select.value;

    const departments = [
        ...new Set(
            employees
                .map(e => e.department)
                .filter(Boolean)
        )
    ].sort((a, b) => a.localeCompare(b));

    select.innerHTML =
        '<option value="">Semua Departemen</option>' +
        departments.map(d => `
            <option value="${escapeHTML(d)}">
                ${escapeHTML(d)}
            </option>
        `).join("");

    select.value = departments.includes(current) ? current : "";
}

function refresh() {
    renderDashboard();
    renderEmployees();
}

// ======================================
// FORM TAMBAH DAN EDIT KARYAWAN
// ======================================

function openModal(employee = null) {
    $("employeeForm").reset();
    $("formError").textContent = "";

    $("editId").value = employee?.id || "";

    $("modalTitle").textContent = employee
        ? "Edit Data Karyawan"
        : "Tambah Karyawan";

    fields.forEach(field => {
        $(field).value = employee?.[field] || "";
    });

    $("employeeModal").hidden = false;
    document.body.style.overflow = "hidden";

    $("nik").focus();
}

function closeModal() {
    $("employeeModal").hidden = true;
    document.body.style.overflow = "";
}

function readForm() {
    const data = {};

    fields.forEach(field => {
        data[field] = $(field).value.trim();
    });

    return data;
}

// ======================================
// DETAIL KARYAWAN
// ======================================

function openDetail(employee) {
    detailEmployeeId = employee.id;

    $("detailAvatar").textContent = initials(employee.name);

    const rows = [
        ["Nama", employee.name],
        ["NIK", employee.nik],
        ["Jenis Kelamin", employee.gender],
        [
            "Tempat, Tgl. Lahir",
            [
                employee.birthPlace,
                formatDate(employee.birthDate)
            ].filter(v => v && v !== "—").join(", ")
        ],
        ["Agama", employee.religion],
        ["Office", employee.office],
        ["Alamat", employee.address],
        ["Email", employee.email],
        ["No. HP", employee.phone]
    ];

    $("detailFields").innerHTML = rows.map(([label, value]) => `
        <div class="detail-row">
            <dt>${escapeHTML(label)}</dt>
            <dd>${escapeHTML(value || "—")}</dd>
        </div>
    `).join("");

    $("detailDepartment").textContent =
        employee.department || "—";

    $("detailPosition").textContent =
        employee.position || "—";

    $("detailExtra").textContent = [
        employee.education
            ? `Pendidikan: ${employee.education}`
            : "",
        employee.joinDate
            ? `Tanggal Masuk: ${formatDate(employee.joinDate)}`
            : "",
        employee.status
            ? `Status: ${employee.status}`
            : ""
    ].filter(Boolean).join(" • ");

    $("qrcodePanel").hidden = true;
    $("employeeQRCode").innerHTML = "";

    $("detailModal").hidden = false;
    document.body.style.overflow = "hidden";
}

function closeDetail() {
    $("detailModal").hidden = true;
    document.body.style.overflow = "";
    detailEmployeeId = null;
}

["closeDetail", "closeDetailBottom"].forEach(id => {
    $(id).addEventListener("click", closeDetail);
});

$("detailModal").addEventListener("click", e => {
    if (e.target === $("detailModal")) {
        closeDetail();
    }
});

$("editFromDetail").addEventListener("click", () => {
    const employee = employees.find(
        emp => emp.id === detailEmployeeId
    );

    if (employee) {
        closeDetail();
        openModal(employee);
    }
});

// ======================================
// GENERATE QR CODE KARYAWAN
// ======================================

function generateEmployeeQRCode() {
    const employee = employees.find(
        emp => emp.id === detailEmployeeId
    );

    if (!employee) {
        showToast("Data karyawan tidak ditemukan!");
        return;
    }

    if (!employee.nik) {
        showToast("NIK karyawan belum diisi!");
        return;
    }

    if (typeof QRCode === "undefined") {
        showToast("Library QR Code belum termuat!");
        return;
    }

    // URL aplikasi dengan parameter NIK
    const qrData =
        window.location.origin +
        window.location.pathname +
        "?nik=" + encodeURIComponent(employee.nik);

    const qrContainer = $("employeeQRCode");

    qrContainer.innerHTML = "";

    new QRCode(qrContainer, {
        text: qrData,
        width: 220,
        height: 220,
        correctLevel: QRCode.CorrectLevel.H
    });

    $("qrcodeNumber").textContent = employee.nik;
    $("qrcodeName").textContent = employee.name;

    $("qrcodePanel").hidden = false;

    $("qrcodePanel").scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

// Tombol Generate QR Code
$("generateQRCode").addEventListener("click", () => {
    generateEmployeeQRCode();
});

// Tombol Sembunyikan QR Code
$("hideQRCode").addEventListener("click", () => {
    $("qrcodePanel").hidden = true;
});

// Tombol Download QR Code
$("downloadQRCode").addEventListener("click", () => {
    const qrContainer = $("employeeQRCode");

    const canvas = qrContainer.querySelector("canvas");
    const image = qrContainer.querySelector("img");

    let imageURL = "";

    if (canvas) {
        imageURL = canvas.toDataURL("image/png");
    } else if (image && image.src) {
        imageURL = image.src;
    } else {
        showToast("Generate QR Code terlebih dahulu!");
        return;
    }

    const employeeNumber = $("qrcodeNumber").textContent;

    const link = document.createElement("a");

    link.href = imageURL;
    link.download = "QR_Karyawan_" + employeeNumber + ".png";

    document.body.appendChild(link);
    link.click();
    link.remove();

    showToast("QR Code berhasil diunduh!");
});

// ======================================
// TOMBOL TAMBAH KARYAWAN
// ======================================

["addFromDashboard", "addEmployeeBtn", "emptyAddBtn"].forEach(id => {
    const button = $(id);

    if (button) {
        button.addEventListener("click", () => {
            openModal();
        });
    }
});

// ======================================
// TOMBOL TUTUP FORM
// ======================================

["closeModal", "cancelModal"].forEach(id => {
    $(id).addEventListener("click", closeModal);
});

$("employeeModal").addEventListener("click", e => {
    if (e.target === $("employeeModal")) {
        closeModal();
    }
});

document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
        if (!$("employeeModal").hidden) {
            closeModal();
        }

        if (!$("detailModal").hidden) {
            closeDetail();
        }
    }
});

// ======================================
// SIMPAN DATA KARYAWAN
// ======================================

$("employeeForm").addEventListener("submit", e => {
    e.preventDefault();

    const data = readForm();
    const id = $("editId").value;

    const duplicate = employees.some(emp =>
        emp.nik.toLowerCase() === data.nik.toLowerCase() &&
        emp.id !== id
    );

    if (duplicate) {
        $("formError").textContent =
            "NIK sudah digunakan. Masukkan NIK yang berbeda.";
        return;
    }

    if (
        data.joinDate &&
        data.birthDate &&
        data.joinDate < data.birthDate
    ) {
        $("formError").textContent =
            "Tanggal masuk kerja tidak boleh sebelum tanggal lahir.";
        return;
    }

    if (
        data.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
    ) {
        $("formError").textContent =
            "Format email tidak valid.";
        return;
    }

    if (id) {
        const index = employees.findIndex(emp => emp.id === id);

        if (index >= 0) {
            employees[index] = {
                ...employees[index],
                ...data,
                updatedAt: new Date().toISOString()
            };
        }
    } else {
        employees.push({
            ...data,
            id: window.crypto?.randomUUID
                ? crypto.randomUUID()
                : String(Date.now()),
            createdAt: new Date().toISOString()
        });
    }

    saveEmployees();
    closeModal();
    refresh();

    showToast(
        id
            ? "Data karyawan berhasil diperbarui."
            : "Data karyawan berhasil ditambahkan."
    );
});

// ======================================
// DETAIL, EDIT, DAN HAPUS
// ======================================

$("employeeTable").addEventListener("click", e => {
    const detail = e.target.closest("[data-detail]");
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-delete]");

    if (detail) {
        const employee = employees.find(
            emp => emp.id === detail.dataset.detail
        );

        if (employee) openDetail(employee);
    }

    if (edit) {
        const employee = employees.find(
            emp => emp.id === edit.dataset.edit
        );

        if (employee) openModal(employee);
    }

    if (del) {
        const employee = employees.find(
            emp => emp.id === del.dataset.delete
        );

        if (
            employee &&
            confirm(`Hapus data karyawan ${employee.name}?`)
        ) {
            employees = employees.filter(
                emp => emp.id !== del.dataset.delete
            );

            saveEmployees();
            refresh();

            showToast("Data karyawan berhasil dihapus.");
        }
    }
});

// ======================================
// PENCARIAN DAN FILTER
// ======================================

["searchInput", "departmentFilter", "statusFilter"].forEach(id => {
    $(id).addEventListener(
        id === "searchInput" ? "input" : "change",
        renderEmployees
    );
});

// ======================================
// EXPORT DATA CSV
// ======================================

$("exportBtn").addEventListener("click", () => {
    if (!employees.length) {
        showToast("Belum ada data untuk diekspor.");
        return;
    }

    const headers = [
        "NIK",
        "Nama Lengkap",
        "Jenis Kelamin",
        "Tempat Lahir",
        "Tanggal Lahir",
        "Nomor Telepon",
        "Email",
        "Alamat",
        "Pendidikan",
        "Departemen",
        "Jabatan",
        "Tanggal Masuk",
        "Status"
    ];

    const rows = employees.map(e => [
        e.nik,
        e.name,
        e.gender,
        e.birthPlace,
        e.birthDate,
        e.phone,
        e.email,
        e.address,
        e.education,
        e.department,
        e.position,
        e.joinDate,
        e.status
    ]);

    const csv = [headers, ...rows]
        .map(row =>
            row.map(value =>
                `"${String(value ?? "").replace(/"/g, '""')}"`
            ).join(",")
        )
        .join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download =
        `data_karyawan_${new Date().toISOString().slice(0, 10)}.csv`;

    a.click();

    URL.revokeObjectURL(url);

    showToast("File CSV berhasil dibuat.");
});

// ======================================
// INISIALISASI APLIKASI
// ======================================

refresh();
