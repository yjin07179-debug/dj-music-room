import json
import logging
import os
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from google import genai


BASE_DIR = Path(__file__).resolve().parent
MODEL_NAME = "gemini-2.5-flash"
RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "reply": {"type": "STRING"},
        "recommendations": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "title": {"type": "STRING"},
                    "artist": {"type": "STRING"},
                },
                "required": ["title", "artist"],
            },
        },
    },
    "required": ["reply", "recommendations"],
}

app = Flask(__name__, static_folder=None)
logging.basicConfig(level=logging.INFO)


def generate_recommendations(prompt):
    try:
        api_key = os.environ["GEMINI_API_KEY"]
    except KeyError:
        return None, (jsonify(error="서버에 GEMINI_API_KEY가 설정되지 않았습니다. 실행 방법을 확인해 주세요."), 503)

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": RESPONSE_SCHEMA,
            },
        )
        result = json.loads(response.text)
        reply = result.get("reply")
        recommendations = result.get("recommendations")
        if not isinstance(reply, str) or not isinstance(recommendations, list):
            raise ValueError("Unexpected Gemini response shape")

        clean_recommendations = []
        for item in recommendations[:6]:
            if not isinstance(item, dict):
                continue
            title = item.get("title")
            artist = item.get("artist")
            if isinstance(title, str) and title.strip() and isinstance(artist, str) and artist.strip():
                clean_recommendations.append({
                    "title": title.strip()[:200],
                    "artist": artist.strip()[:200],
                })
        return {
            "reply": reply.strip()[:2000],
            "recommendations": clean_recommendations,
        }, None
    except Exception:
        app.logger.exception("Gemini recommendation request failed")
        return None, (jsonify(error="AI 음악 추천 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."), 502)


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/script.js")
def script():
    return send_from_directory(BASE_DIR, "script.js")


@app.get("/style.css")
def stylesheet():
    return send_from_directory(BASE_DIR, "style.css")


@app.post("/api/chat")
def chat():
    payload = request.get_json(silent=True)
    messages = payload.get("messages") if isinstance(payload, dict) else None
    if not isinstance(messages, list) or not messages or len(messages) > 12:
        return jsonify(error="대화 내용을 확인해 주세요."), 400

    conversation = []
    for message in messages:
        if not isinstance(message, dict) or message.get("role") not in ("user", "assistant"):
            return jsonify(error="대화 형식이 올바르지 않습니다."), 400
        content = message.get("content")
        if not isinstance(content, str) or not content.strip() or len(content) > 500:
            return jsonify(error="메시지는 500자 이내로 입력해 주세요."), 400
        speaker = "사용자" if message["role"] == "user" else "AI DJ"
        conversation.append(f"{speaker}: {content.strip()}")

    prompt = (
        "당신은 DJ MUSIC ROOM의 친절한 한국어 음악 추천 DJ입니다. "
        "사용자의 대화 맥락에 맞춰 자연스럽게 답하고, 추천 곡은 실제 발매된 곡으로 최대 5곡 제안하세요. "
        "reply에는 한국어 답변을 작성하고 recommendations에는 검색할 정확한 곡 제목과 아티스트를 넣으세요. "
        "추천이 필요 없는 인사나 일반 질문이면 recommendations는 빈 배열로 반환하세요.\n\n"
        + "\n".join(conversation)
    )
    result, error = generate_recommendations(prompt)
    return error if error else jsonify(result)


@app.post("/api/recommend")
def recommend():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify(error="곡 정보를 확인해 주세요."), 400
    track_name = payload.get("track_name")
    artist_name = payload.get("artist_name")
    if (
        not isinstance(track_name, str)
        or not track_name.strip()
        or len(track_name) > 200
        or not isinstance(artist_name, str)
        or not artist_name.strip()
        or len(artist_name) > 200
    ):
        return jsonify(error="곡 제목과 아티스트를 확인해 주세요."), 400

    prompt = (
        "당신은 DJ MUSIC ROOM의 한국어 음악 추천 DJ입니다. "
        "아래 곡과 장르, 분위기, 사운드가 비슷한 실제 발매곡을 최대 5곡 추천하세요. "
        "reply는 간결한 한국어 설명으로, recommendations에는 정확한 곡 제목과 아티스트를 넣으세요.\n"
        f"곡 제목: {track_name.strip()}\n아티스트: {artist_name.strip()}"
    )
    result, error = generate_recommendations(prompt)
    return error if error else jsonify(result)


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "5000")),
        debug=False,
    )
