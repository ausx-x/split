/* ==========================================================================
   Splitwise Create Group & Add Friend Modals
   ========================================================================== */

const GroupModal = {
  init() {
    this.modalEl = document.getElementById("create-group-modal");
    if (!this.modalEl) return;
    this.attachEvents();
  },

  open() {
    this.render();
    this.modalEl.classList.add("active");
  },

  close() {
    this.modalEl.classList.remove("active");
  },

  render() {
    const container = this.modalEl.querySelector(".modal-body");
    const friends = store.getFriends();

    container.innerHTML = `
      <div style="margin-bottom:14px;">
        <label class="field-label">My group shall be called...</label>
        <input type="text" id="new-group-name" class="expense-field-input" placeholder="e.g. Ski Trip 2026, Summer Lakehouse" style="font-size:15px; font-weight:600;" autofocus />
      </div>

      <div style="margin-bottom:14px;">
        <label class="field-label">Group Type</label>
        <div style="display:flex; gap:8px;">
          <label class="btn btn-secondary" style="flex:1; cursor:pointer;">
            <input type="radio" name="group-type-radio" value="Trip" checked /> ✈️ Trip
          </label>
          <label class="btn btn-secondary" style="flex:1; cursor:pointer;">
            <input type="radio" name="group-type-radio" value="Home" /> 🏠 Home
          </label>
          <label class="btn btn-secondary" style="flex:1; cursor:pointer;">
            <input type="radio" name="group-type-radio" value="Couple" /> ❤️ Couple
          </label>
          <label class="btn btn-secondary" style="flex:1; cursor:pointer;">
            <input type="radio" name="group-type-radio" value="Other" /> 👥 Other
          </label>
        </div>
      </div>

      <div>
        <label class="field-label">Select Members to Include</label>
        <div style="display:flex; flex-direction:column; gap:6px; max-height:160px; overflow-y:auto; padding:4px;">
          ${friends.map(f => `
            <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer; padding:4px 0;">
              <input type="checkbox" class="group-member-checkbox" value="${f.id}" checked />
              <div class="user-avatar" style="width:20px; height:20px; font-size:9px; background:${f.color}; color:#fff;">${f.initials}</div>
              <span>${f.name}</span>
            </label>
          `).join("")}
        </div>
      </div>
    `;
  },

  attachEvents() {
    this.modalEl.querySelector(".modal-close-btn").addEventListener("click", () => this.close());
    this.modalEl.querySelector("#btn-cancel-group").addEventListener("click", () => this.close());

    this.modalEl.querySelector("#btn-save-group").addEventListener("click", async () => {
      const nameInput = this.modalEl.querySelector("#new-group-name");
      const name = nameInput.value.trim();

      if (!name) {
        alert("Please enter a group name.");
        nameInput.focus();
        return;
      }

      const typeRadio = this.modalEl.querySelector('input[name="group-type-radio"]:checked');
      const type = typeRadio ? typeRadio.value : "Other";

      const iconMap = { Trip: "✈️", Home: "🏠", Couple: "❤️", Other: "👥" };

      const selectedIds = [store.getCurrentUser().id];
      this.modalEl.querySelectorAll(".group-member-checkbox:checked").forEach(cb => {
        selectedIds.push(cb.value);
      });

      try {
        const newGrp = await store.addGroup({
          name,
          type,
          icon: iconMap[type] || "🏠",
          members: selectedIds
        });

        UI.showToast(`Group "${newGrp.name}" created!`);
        this.close();
        window.SplitwiseApp.navigateTo("group", newGrp.id);
      } catch (err) {
        alert("Error creating group: " + err.message);
      }
    });
  }
};

const FriendModal = {
  init() {
    this.modalEl = document.getElementById("add-friend-modal");
    if (!this.modalEl) return;
    this.attachEvents();
  },

  open() {
    this.modalEl.querySelector("#new-friend-name").value = "";
    this.modalEl.querySelector("#new-friend-email").value = "";
    this.modalEl.classList.add("active");
    this.modalEl.querySelector("#new-friend-name").focus();
  },

  close() {
    this.modalEl.classList.remove("active");
  },

  attachEvents() {
    this.modalEl.querySelector(".modal-close-btn").addEventListener("click", () => this.close());
    this.modalEl.querySelector("#btn-cancel-friend").addEventListener("click", () => this.close());

    this.modalEl.querySelector("#btn-save-friend").addEventListener("click", async () => {
      const nameInp = this.modalEl.querySelector("#new-friend-name");
      const emailInp = this.modalEl.querySelector("#new-friend-email");

      const name = nameInp.value.trim();
      const email = emailInp.value.trim();

      if (!email) {
        alert("Please enter friend's email address.");
        emailInp.focus();
        return;
      }

      try {
        const newFriend = await store.addFriend({ name: name || email.split('@')[0], email });
        UI.showToast(`Added ${newFriend.name} as a friend!`);
        this.close();
        window.SplitwiseApp.navigateTo("friend", newFriend.id);
      } catch (err) {
        alert("Error adding friend: " + err.message);
      }
    });
  }
};

window.GroupModal = GroupModal;
window.FriendModal = FriendModal;
