document.addEventListener("DOMContentLoaded", () => {
  const sendBtn = document.getElementById("send");
  const fileInput = document.getElementById("file");
  const delayInput = document.getElementById("delay");
  const threadList = document.getElementById("threads");

  let threads = JSON.parse(localStorage.getItem("threads") || "{}");

  function saveThreads() {
    localStorage.setItem("threads", JSON.stringify(threads));
  }

  sendBtn.addEventListener("click", () => {
    const cookie = document.getElementById("cookie").value.trim();
    const threadID = document.getElementById("thread").value.trim();
    const delay = parseInt(delayInput.value.trim()) * 1000;

    if (!cookie || !threadID || !fileInput.files.length || isNaN(delay)) {
      alert("Please fill all fields and select a .txt file.");
      return;
    }

    if (threads[threadID]) {
      alert("Thread already exists in history or running!");
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const messages = reader.result.split("\n").map(m => m.trim()).filter(Boolean);
      if (!messages.length) {
        alert("The message file is empty!");
        return;
      }

      const url = `https://www.facebook.com/messages/t/${threadID}`;
      threads[threadID] = { url, messages, delay, index: 0, count: 0, running: true };
      saveThreads();

      chrome.tabs.create({ url }, (tab) => {
        const maxAttempts = 10;
        let attempt = 0;

        const trySendMessage = () => {
          const thread = threads[threadID];
          if (!thread || !thread.running || thread.index >= thread.messages.length) return;

          const message = thread.messages[thread.index];
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (cookie, message) => {
              document.cookie = cookie;
              const textbox = document.querySelector('[role="textbox"]') || document.querySelector('[contenteditable="true"]');
              if (!textbox) return false;
              textbox.focus();
              document.execCommand('insertText', false, message);
              setTimeout(() => {
                const enter = new KeyboardEvent('keydown', {
                  key: 'Enter',
                  code: 'Enter',
                  keyCode: 13,
                  which: 13,
                  bubbles: true
                });
                textbox.dispatchEvent(enter);
              }, 1000);
              return true;
            },
            args: [cookie, message]
          }, (results) => {
            const success = results && results[0] && results[0].result;
            if (!success && attempt < maxAttempts) {
              attempt++;
              setTimeout(trySendMessage, 2000);
            } else if (!success) {
              threads[threadID].running = false;
              saveThreads();
              updateThreadsUI();
              alert("❌ Message box not found.");
            } else {
              threads[threadID].index++;
              threads[threadID].count++;
              saveThreads();
              updateThreadsUI();
              if (threads[threadID].index < threads[threadID].messages.length) {
                setTimeout(trySendMessage, delay);
              } else {
                threads[threadID].running = false;
                saveThreads();
                updateThreadsUI();
              }
            }
          });
        };

        setTimeout(trySendMessage, 8000); // extra wait for slow tab
        updateThreadsUI();
      });
    };

    reader.readAsText(file);
  });

  function updateThreadsUI() {
    threadList.innerHTML = '';
    for (const id in threads) {
      const t = threads[id];
      const div = document.createElement("div");
      div.className = "thread-box";
      div.innerHTML = `
        <div class="thread-header">🧵 <a href="${t.url}" target="_blank">${id}</a></div>
        <div class="thread-details">
          ⏱ Delay: ${t.delay / 1000}s<br/>
          📨 Sent: ${t.count} / ${t.messages.length}<br/>
          🔁 Status: ${t.running ? "🟢 Active" : "🔴 Stopped"}
        </div>
        <button data-id="${id}" class="stop-btn">⛔ Stop</button>
        <button data-id="${id}" class="close-btn">❌ Remove</button>
      `;
      threadList.appendChild(div);
    }

    document.querySelectorAll(".stop-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (threads[id]) {
          threads[id].running = false;
          saveThreads();
          updateThreadsUI();
        }
      });
    });

    document.querySelectorAll(".close-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        delete threads[id];
        saveThreads();
        updateThreadsUI();
      });
    });
  }

  updateThreadsUI();
});
