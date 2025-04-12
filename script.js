// ✅ Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDEFf0DCI7hyEUR-1zJlySt-J-1e0LbYWU",
  authDomain: "catering-reservation-project.firebaseapp.com",
  projectId: "catering-reservation-project",
  storageBucket: "catering-reservation-project.appspot.com",
  messagingSenderId: "151942504169",
  appId: "1:151942504169:web:119d68d08f690785f81a78",
};

// ✅ Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/* ===============================
   ✅ Toast Notification Function
================================= */
function showToast(message, type = "success") {
  const toastContainer = document.getElementById("toast-container");
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

/* ===============================
   ✅ Authentication Functions
================================= */
async function register() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection("users").doc(cred.user.uid).set({
      email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showToast("Registered successfully!");
  } catch (error) {
    console.error("Registration Error:", error);
    showToast("Failed to register. Try again.", "error");
  }
}

async function login() {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  try {
    await auth.signInWithEmailAndPassword(email, password);
    showToast("Login successful!");
    window.location.href = "dashboard.html";
  } catch (error) {
    console.error("Login Error:", error);
    showToast("Login failed: " + error.message, "error");
  }
}

function logout() {
  auth.signOut()
    .then(() => {
      localStorage.removeItem("cart");
      showToast("Logged out successfully!");
      window.location.href = "index.html";
    })
    .catch((error) => {
      console.error("Logout Error:", error);
      showToast("Logout failed: " + error.message, "error");
    });
}

/* ===============================
   ✅ Auth State Listener
================================= */
auth.onAuthStateChanged((user) => {
  const path = window.location.pathname;

  const userInfo = document.getElementById("user-info");
  const logoutBtn = document.getElementById("logout-btn");
  const ordersList = document.getElementById("ordersList");

  if (user) {
    if (userInfo) {
      userInfo.innerText = `Logged in as: ${user.email}`;
      userInfo.style.display = "block";
    }
    if (logoutBtn) logoutBtn.style.display = "inline-block";

    if (path.includes("dashboard.html")) {
      if (ordersList) ordersList.innerHTML = "";
      fetchUserOrders();
    }

    if (path.includes("calendar.html")) {
      renderCalendarEvents();
    }

    if (path.includes("admin.html")) {
      if (user.email === "admin@example.com") {
        fetchAllOrders();
      } else {
        showToast("Access denied.", "error");
        window.location.href = "index.html";
      }
    }

  } else {
    if (userInfo) userInfo.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (ordersList) {
      ordersList.innerHTML = "<p>Please login to see your orders.</p>";
    }
    if (path.includes("calendar.html") || path.includes("dashboard.html") || path.includes("admin.html")) {
      showToast("Please login to access this page.", "error");
      window.location.href = "index.html";
    }
  }
});

/* ===============================
   ✅ DOM Ready – Form Logic
================================= */
document.addEventListener("DOMContentLoaded", () => {
  const orderForm = document.getElementById("order-form");
  const priceEstimate = document.getElementById("price-estimate");

  const eventFilter = document.getElementById("eventFilter");
  const sortOrder = document.getElementById("sortOrder");

  if (eventFilter && sortOrder) {
    eventFilter.addEventListener("change", fetchUserOrders);
    sortOrder.addEventListener("change", fetchUserOrders);
  }

  const updatePrice = () => {
    const numPeople = parseInt(document.getElementById("num-people").value) || 0;
    const checkedItems = document.querySelectorAll("input[type='checkbox']:checked");
    let total = 0;

    checkedItems.forEach(item => {
      const pricePerPerson = parseInt(item.getAttribute("data-price"));
      total += pricePerPerson * numPeople;
    });

    if (priceEstimate) {
      priceEstimate.textContent = total;
    }
  };

  const menuOptions = document.querySelectorAll("input[type='checkbox']");
  menuOptions.forEach(option => option.addEventListener("change", updatePrice));

  const numPeopleInput = document.getElementById("num-people");
  if (numPeopleInput) numPeopleInput.addEventListener("input", updatePrice);

  if (orderForm) {
    orderForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const eventType = document.getElementById("event-type").value;
      const eventDate = document.getElementById("event-date").value;
      const numPeople = parseInt(document.getElementById("num-people").value);
      const menuCheckboxes = document.querySelectorAll("input[type='checkbox']:checked");
      const menu = Array.from(menuCheckboxes).map(cb => cb.value);

      const customerName = document.getElementById("customer-name").value;
      const customerPhone = document.getElementById("customer-phone").value;
      const customerAddress = document.getElementById("customer-address").value;

      const user = auth.currentUser;
      if (!user) {
        showToast("You must be logged in to place an order.", "error");
        return;
      }

      try {
        await db.collection("orders").add({
          eventType,
          eventDate,
          numPeople,
          menu,
          totalCost: parseInt(priceEstimate.textContent),
          userId: user.uid,
          customerName,
          customerPhone,
          customerAddress,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        showToast("Order placed successfully!");
        orderForm.reset();
        if (priceEstimate) priceEstimate.textContent = "0";
        document.getElementById("customer-name").value = "";
        document.getElementById("customer-phone").value = "";
        document.getElementById("customer-address").value = "";

        fetchUserOrders();

      } catch (error) {
        console.error("Error placing order:", error);
        showToast("Failed to place order.", "error");
      }
    });
  }
});

/* ===============================
   ✅ Firestore Operations
================================= */
async function fetchUserOrders() {
  const user = auth.currentUser;
  if (!user) return;

  const ordersList = document.getElementById("ordersList");
  const eventFilter = document.getElementById("eventFilter")?.value || "";
  const sortOrder = document.getElementById("sortOrder")?.value || "desc";

  try {
    let query = db.collection("orders")
      .where("userId", "==", user.uid)
      .orderBy("createdAt", sortOrder);

    const snapshot = await query.get();

    ordersList.innerHTML = "<h2>Your Catering Orders</h2>";
    let hasOrders = false;

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (eventFilter && data.eventType !== eventFilter) return;

      hasOrders = true;
      const orderItem = document.createElement("div");
      orderItem.innerHTML = `
        <h3>${data.eventType}</h3>
        <p><strong>Date:</strong> ${data.eventDate}</p>
        <p><strong>People:</strong> ${data.numPeople}</p>
        <p><strong>Name:</strong> ${data.customerName || "N/A"}</p>
        <p><strong>Phone:</strong> ${data.customerPhone || "N/A"}</p>
        <p><strong>Address:</strong> ${data.customerAddress || "N/A"}</p>
        <p><strong>Menu:</strong> ${data.menu.join(", ")}</p>
        <p><strong>Total:</strong> ₹${data.totalCost || "N/A"}</p>
        <hr/>
      `;
      ordersList.appendChild(orderItem);
    });

    if (!hasOrders) {
      ordersList.innerHTML += "<p>No matching orders found.</p>";
    }

  } catch (error) {
    console.error("Error fetching orders:", error);
    showToast("Failed to load orders.", "error");
  }
}

async function renderCalendarEvents() {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const snapshot = await db.collection("orders").get();
    const events = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      events.push({
        title: `${data.eventType} (${data.numPeople} people)`,
        start: data.eventDate,
        allDay: true,
      });
    });

    const calendarEl = document.getElementById("calendar");
    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      height: "auto",
      events: events,
    });

    calendar.render();
  } catch (error) {
    console.error("Calendar load error:", error);
    showToast("Failed to load calendar events.", "error");
  }
}
