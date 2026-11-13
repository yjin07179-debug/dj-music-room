const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#music-search");
const mixGrid = document.querySelector("#mix-grid");
const genreButtons = [...document.querySelectorAll(".genre-tag")];
const searchMessage = document.querySelector("#search-message");
const emptyState = document.querySelector("#empty-state");
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const chatMessages = document.querySelector("#chat-messages");
const chatStatus = document.querySelector("#chat-status");
const player = document.querySelector(".player");
const playButton = document.querySelector("#main-play");
const playerTitle = document.querySelector("#player-title");
const playerArtist = document.querySelector("#player-artist");
const currentTime = document.querySelector("#current-time");
const audioDuration = document.querySelector("#audio-duration");
const progressFill = document.querySelector("#progress-fill");
const audio = document.querySelector("#audio-player");

const genreSearchTerms = {
  EDM: "EDM",
  HOUSE: "house",
  TECHNO: "techno",
  TRANCE: "trance",
  "FUTURE BASS": "future bass",
  "PROGRESSIVE HOUSE": "progressive house",
};

let activeSearchController;
const chatHistory = [];

function setSearchMessage(message, isLoading = false) {
  searchMessage.textContent = message;
  searchMessage.classList.toggle("is-loading", isLoading);
}

function safeHttpsUrl(value) {
  if (typeof value !== "string") return "";

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function createIcon(className, isPause = false) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 20 20");
  icon.setAttribute("fill", "none");
  icon.setAttribute("aria-hidden", "true");
  icon.classList.add(className);

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", isPause ? "M7 5v10M13 5v10" : "m7 4.8 8 5.2-8 5.2V4.8Z");
  icon.append(path);
  return icon;
}

function createPreviewButton(track, className) {
  const button = document.createElement("button");
  const previewUrl = safeHttpsUrl(track.previewUrl);
  button.type = "button";
  button.className = className;
  button.dataset.previewUrl = previewUrl;
  button.dataset.trackName = track.trackName;
  button.dataset.artistName = track.artistName;
  button.setAttribute(
    "aria-label",
    previewUrl ? `${track.trackName} 미리 듣기` : `${track.trackName} 미리 듣기 없음`,
  );
  button.disabled = !previewUrl;
  button.append(createIcon("icon-play"), createIcon("icon-pause", true));
  return button;
}

function createMixCard(track, index) {
  const card = document.createElement("article");
  card.className = "mix-card";

  const cover = document.createElement("div");
  cover.className = "cover cover--api";

  const artworkUrl = safeHttpsUrl(track.artworkUrl100 || track.artworkUrl60);
  if (artworkUrl) {
    const artwork = document.createElement("img");
    artwork.className = "cover-art";
    artwork.src = artworkUrl.replace("100x100bb", "600x600bb");
    artwork.alt = `${track.trackName} 앨범 커버`;
    artwork.loading = "lazy";
    artwork.addEventListener("error", () => artwork.remove(), { once: true });
    cover.append(artwork);
  }

  const grain = document.createElement("div");
  grain.className = "cover-grain";
  grain.setAttribute("aria-hidden", "true");
  cover.append(grain);

  const coverIndex = document.createElement("span");
  coverIndex.className = "cover-index";
  coverIndex.textContent = `${String(index + 1).padStart(2, "0")} / 12`;
  cover.append(coverIndex, createPreviewButton(track, "cover-play"));

  const trackInfo = document.createElement("div");
  trackInfo.className = "track-info";

  const trackCopy = document.createElement("div");
  trackCopy.className = "track-copy";
  const title = document.createElement("h3");
  title.textContent = track.trackName;
  const details = document.createElement("p");
  const artist = document.createTextNode(track.artistName);
  details.append(artist);

  if (typeof track.primaryGenreName === "string" && track.primaryGenreName) {
    const separator = document.createElement("span");
    separator.textContent = "·";
    details.append(separator, document.createTextNode(track.primaryGenreName));
  }

  trackCopy.append(title, details);

  const similarButton = document.createElement("button");
  similarButton.type = "button";
  similarButton.className = "similar-track-button";
  similarButton.dataset.action = "recommend";
  similarButton.dataset.trackName = track.trackName;
  similarButton.dataset.artistName = track.artistName;
  similarButton.textContent = "비슷한 곡 찾기";
  trackCopy.append(similarButton);

  if (!safeHttpsUrl(track.previewUrl)) {
    const unavailable = document.createElement("span");
    unavailable.className = "track-preview-note";
    unavailable.textContent = "미리 듣기 없음";
    trackCopy.append(unavailable);
  }

  trackInfo.append(trackCopy, createPreviewButton(track, "track-play"));
  card.append(cover, trackInfo);
  return card;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function updateProgress() {
  currentTime.textContent = formatTime(audio.currentTime);
  const duration = audio.duration;
  const progress = Number.isFinite(duration) && duration > 0
    ? (audio.currentTime / duration) * 100
    : 0;
  progressFill.style.width = `${progress}%`;
}

function updatePreviewButtons() {
  mixGrid.querySelectorAll("[data-preview-url]").forEach((button) => {
    if (!button.dataset.previewUrl) return;
    const isCurrentTrack = button.dataset.previewUrl && button.dataset.previewUrl === audio.src;
    const isPlaying = isCurrentTrack && !audio.paused;
    button.closest(".mix-card").classList.toggle("is-playing", isPlaying);
    button.classList.toggle("is-playing", isPlaying);
    button.setAttribute(
      "aria-label",
      isCurrentTrack
        ? (isPlaying ? `${button.dataset.trackName} 일시 정지` : `${button.dataset.trackName} 이어 듣기`)
        : `${button.dataset.trackName} 미리 듣기`,
    );
  });
}

function setPlaying(isPlaying) {
  player.classList.toggle("is-playing", isPlaying);
  playButton.setAttribute("aria-label", isPlaying ? "미리 듣기 일시 정지" : "미리 듣기 재생");
  updatePreviewButtons();
}

async function playTrack(button) {
  const previewUrl = button.dataset.previewUrl;
  if (!previewUrl) {
    setSearchMessage("이 곡은 미리 듣기를 제공하지 않습니다.");
    return;
  }

  if (audio.src === previewUrl && !audio.paused) {
    audio.pause();
    return;
  }

  if (audio.src !== previewUrl) {
    audio.pause();
    audio.src = previewUrl;
    audio.load();
    playerTitle.textContent = button.dataset.trackName;
    playerArtist.textContent = button.dataset.artistName;
    currentTime.textContent = "0:00";
    audioDuration.textContent = "미리 듣기";
    progressFill.style.width = "0%";
  } else if (audio.ended) {
    audio.currentTime = 0;
  }

  playButton.disabled = false;
  try {
    await audio.play();
  } catch {
    setPlaying(false);
    setSearchMessage("미리 듣기를 재생할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }
}

async function searchMusic(rawQuery, { initial = false } = {}) {
  const query = rawQuery.trim();
  activeSearchController?.abort();
  activeSearchController = undefined;

  if (!query) {
    searchForm.removeAttribute("aria-busy");
    mixGrid.replaceChildren();
    emptyState.hidden = true;
    setSearchMessage("검색어를 입력하거나 장르를 선택해 주세요.");
    return;
  }

  const controller = new AbortController();
  activeSearchController = controller;
  searchForm.setAttribute("aria-busy", "true");
  mixGrid.replaceChildren();
  emptyState.hidden = true;
  setSearchMessage("음악을 검색하고 있어요...", true);

  const normalizedQuery = query.toUpperCase();
  const term = Object.prototype.hasOwnProperty.call(genreSearchTerms, normalizedQuery)
    ? genreSearchTerms[normalizedQuery]
    : query;
  try {
    const results = await searchItunes(term, 12, controller.signal);

    results.forEach((track, index) => {
      mixGrid.append(createMixCard(track, index));
    });

    if (results.length === 0) {
      emptyState.hidden = false;
      setSearchMessage(`“${query}” 검색 결과가 없습니다. 다른 검색어로 다시 시도해 보세요.`);
    } else if (initial) {
      setSearchMessage(`추천 ${query} 음악 ${results.length}곡을 불러왔어요.`);
    } else {
      setSearchMessage(`“${query}” 검색 결과 ${results.length}곡`);
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    setSearchMessage("음악 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
  } finally {
    if (activeSearchController === controller) {
      activeSearchController = undefined;
      searchForm.removeAttribute("aria-busy");
      searchMessage.classList.remove("is-loading");
    }
  }
}

async function searchItunes(term, limit, signal) {
  const params = new URLSearchParams({
    term,
    entity: "song",
    media: "music",
    limit: String(limit),
  });
  const response = await fetch(`https://itunes.apple.com/search?${params}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`iTunes API returned ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.results)
    ? payload.results
      .filter((track) => (
        track
        && typeof track === "object"
        && typeof track.trackName === "string"
        && typeof track.artistName === "string"
      ))
      .slice(0, limit)
    : [];
}

function appendChatMessage(text, role) {
  const message = document.createElement("p");
  message.className = `chat-bubble chat-bubble--${role}`;
  message.textContent = text;
  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return message;
}

async function requestAiRecommendations(endpoint, body) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "AI 추천을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  return payload;
}

async function showRecommendedTracks(recommendations) {
  activeSearchController?.abort();
  activeSearchController = undefined;
  searchForm.removeAttribute("aria-busy");
  mixGrid.replaceChildren();
  emptyState.hidden = true;
  setSearchMessage("추천 곡을 iTunes에서 검색하고 있어요...", true);

  try {
    const tracks = await Promise.all(recommendations.slice(0, 6).map((recommendation) => {
      const term = `${recommendation.title} ${recommendation.artist}`;
      return searchItunes(term, 2).then((results) => results[0]);
    }));
    const uniqueTracks = [...new Map(
      tracks.filter((track) => track && track.trackId).map((track) => [track.trackId, track]),
    ).values()];
    uniqueTracks.forEach((track, index) => mixGrid.append(createMixCard(track, index)));
    emptyState.hidden = uniqueTracks.length > 0;
    setSearchMessage(
      uniqueTracks.length
        ? `AI 추천곡 ${uniqueTracks.length}곡을 iTunes에서 찾았어요.`
        : "추천곡을 iTunes에서 찾지 못했어요. 다른 요청을 해보세요.",
    );
  } catch {
    setSearchMessage("추천곡 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
  } finally {
    searchMessage.classList.remove("is-loading");
  }
}

async function sendChatMessage(message) {
  appendChatMessage(message, "user");
  chatHistory.push({ role: "user", content: message });
  chatStatus.textContent = "AI DJ가 취향에 맞는 음악을 찾고 있어요...";
  chatForm.setAttribute("aria-busy", "true");
  chatForm.querySelector("button").disabled = true;

  try {
    const payload = await requestAiRecommendations("/api/chat", {
      messages: chatHistory.slice(-12),
    });
    if (typeof payload.reply !== "string" || !Array.isArray(payload.recommendations)) {
      throw new Error("AI 응답을 읽을 수 없습니다. 다시 시도해 주세요.");
    }
    appendChatMessage(payload.reply, "assistant");
    chatHistory.push({ role: "assistant", content: payload.reply });
    if (payload.recommendations.length) {
      await showRecommendedTracks(payload.recommendations);
    }
    chatStatus.textContent = "";
  } catch (error) {
    chatHistory.pop();
    appendChatMessage(error.message || "AI 추천 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", "assistant");
    chatStatus.textContent = "";
  } finally {
    chatForm.removeAttribute("aria-busy");
    chatForm.querySelector("button").disabled = false;
    chatInput.focus();
  }
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (chatForm.hasAttribute("aria-busy")) return;
  const message = chatInput.value.trim();
  if (!message) return;
  chatInput.value = "";
  sendChatMessage(message);
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  genreButtons.forEach((button) => button.classList.remove("is-selected"));
  searchMusic(searchInput.value);
});

genreButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const genre = button.dataset.genre;
    searchInput.value = genre;
    genreButtons.forEach((item) => item.classList.toggle("is-selected", item === button));
    searchMusic(genre);
  });
});

mixGrid.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.action === "recommend") {
    const { trackName, artistName } = button.dataset;
    appendChatMessage(`“${trackName}” - ${artistName}와 비슷한 곡을 찾아줘`, "user");
    chatStatus.textContent = "비슷한 음악을 찾고 있어요...";
    requestAiRecommendations("/api/recommend", {
      track_name: trackName,
      artist_name: artistName,
    }).then(async (payload) => {
      if (typeof payload.reply !== "string" || !Array.isArray(payload.recommendations)) {
        throw new Error("AI 응답을 읽을 수 없습니다. 다시 시도해 주세요.");
      }
      appendChatMessage(payload.reply, "assistant");
      if (Array.isArray(payload.recommendations) && payload.recommendations.length) {
        await showRecommendedTracks(payload.recommendations);
      }
    }).catch((error) => {
      appendChatMessage(error.message || "AI 추천 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", "assistant");
    }).finally(() => {
      chatStatus.textContent = "";
    });
    return;
  }
  if (button.dataset.previewUrl) playTrack(button);
});

playButton.addEventListener("click", async () => {
  if (!audio.src) return;
  if (audio.paused) {
    try {
      await audio.play();
    } catch {
      setPlaying(false);
      setSearchMessage("미리 듣기를 재생할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    }
  } else {
    audio.pause();
  }
});

audio.addEventListener("play", () => setPlaying(true));
audio.addEventListener("pause", () => setPlaying(false));
audio.addEventListener("ended", () => setPlaying(false));
audio.addEventListener("timeupdate", updateProgress);
audio.addEventListener("loadedmetadata", () => {
  audioDuration.textContent = formatTime(audio.duration);
});
audio.addEventListener("error", () => {
  if (audio.src) {
    setPlaying(false);
    setSearchMessage("미리 듣기를 불러오지 못했습니다. 다른 곡을 선택해 주세요.");
  }
});

const defaultGenreButton = genreButtons.find((button) => button.dataset.genre === "EDM");
defaultGenreButton?.classList.add("is-selected");
searchMusic("EDM", { initial: true });
