const LICENSE_SERVER = "https://subscription-server.onrender.com"

const STORAGE_KEY = "vs_license_key"
const DEMO_KEY = "vs_demo_mode"

function getParams() {
  return new URLSearchParams(window.location.search)
}

function showLicenseOverlay() {
  const existing = document.getElementById("vs-license-overlay")
  if (existing) return

  const overlay = document.createElement("div")
  overlay.id = "vs-license-overlay"
  overlay.innerHTML = `
    <div style="
      position:fixed;inset:0;z-index:999999;
      background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);
      display:flex;align-items:center;justify-content:center;
      font-family:'DM Sans',system-ui,sans-serif;
    ">
      <div style="
        background:#fff;border-radius:16px;padding:2.5rem;max-width:420px;width:90%;
        box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center;
      ">
        <div style="font-size:2.5rem;margin-bottom:0.5rem;">🔑</div>
        <h2 style="margin:0 0 0.5rem;font-size:1.3rem;color:#1a1a2e;">License Required</h2>
        <p style="color:#6b7280;margin-bottom:1.5rem;font-size:0.9rem;line-height:1.5;">
          This software is licensed. Enter your license key or try the demo.
        </p>
        <div style="display:flex;flex-direction:column;gap:0.75rem;">
          <input id="vs-license-input" type="text" placeholder="VS-XXXXXXXX-XXXXXXXX"
            style="
              padding:0.75rem 1rem;border:2px solid #e5e7eb;border-radius:8px;
              font-family:monospace;font-size:1rem;text-align:center;letter-spacing:1px;
            "
          />
          <button onclick="window.vsActivateLicense()"
            style="
              padding:0.75rem;background:#2563eb;color:#fff;border:none;border-radius:8px;
              font-weight:600;font-size:0.95rem;cursor:pointer;
            "
          >Activate License</button>
          <button onclick="window.vsStartDemo()"
            style="
              padding:0.6rem;background:#f3f4f6;color:#374151;border:none;border-radius:8px;
              font-weight:500;font-size:0.85rem;cursor:pointer;
            "
          >Try Demo (No License)</button>
        </div>
        <p id="vs-license-error" style="color:#dc2626;margin-top:0.75rem;font-size:0.85rem;display:none;"></p>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
}

function removeOverlay() {
  const el = document.getElementById("vs-license-overlay")
  if (el) el.remove()
}

window.vsActivateLicense = async function () {
  const input = document.getElementById("vs-license-input")
  const error = document.getElementById("vs-license-error")
  const key = input.value.trim()
  if (!key) {
    error.textContent = "Please enter a license key"
    error.style.display = "block"
    return
  }
  try {
    const res = await fetch(`${LICENSE_SERVER}/validate?key=${encodeURIComponent(key)}&product=${encodeURIComponent(window.VS_PRODUCT || "")}`)
    const data = await res.json()
    if (data.valid) {
      localStorage.setItem(STORAGE_KEY, key)
      removeOverlay()
      location.reload()
    } else {
      error.textContent = data.reason || "Invalid license key"
      error.style.display = "block"
    }
  } catch {
    error.textContent = "Could not reach license server. Check your internet connection."
    error.style.display = "block"
  }
}

window.vsStartDemo = function () {
  localStorage.setItem(DEMO_KEY, "true")
  removeOverlay()
  location.reload()
}

export async function checkLicense(product) {
  window.VS_PRODUCT = product || "unknown"
  const params = getParams()

  if (params.get("demo") === "1") {
    localStorage.setItem(DEMO_KEY, "true")
  }

  const demoMode = localStorage.getItem(DEMO_KEY) === "true"
  const licenseKey = localStorage.getItem(STORAGE_KEY)

  if (demoMode) return { demo: true }

  if (!licenseKey) {
    showLicenseOverlay()
    return { blocked: true }
  }

  try {
    const res = await fetch(`${LICENSE_SERVER}/validate?key=${encodeURIComponent(licenseKey)}&product=${encodeURIComponent(product)}`)
    const data = await res.json()
    if (data.valid) {
      return { valid: true, days_left: data.days_left, status: data.status }
    }
    showLicenseOverlay()
    return { blocked: true, reason: data.reason }
  } catch {
    return { valid: true, offline: true }
  }
}
