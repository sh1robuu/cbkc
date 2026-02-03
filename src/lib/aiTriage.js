/**
 * AI Triage System
 * Handles initial student assessment using Gemini API
 */

// AI Welcome messages and questions
const AI_WELCOME_MESSAGE = `Xin chào! 👋 Mình là trợ lý ảo của S-Net. Trong khi chờ tư vấn viên, mình muốn hỏi bạn một vài câu để hiểu rõ hơn về tình trạng của bạn.`

const AI_QUESTIONS = [
    'Bạn có chuyện gì cần tư vấn hôm nay không? 💭',
    'Bạn đang cảm thấy như thế nào? 🤗'
]

const AI_WAIT_MESSAGE = `Cảm ơn bạn đã chia sẻ. Tư vấn viên sẽ sớm liên hệ với bạn. Trong lúc chờ đợi, hãy nhớ rằng bạn không đơn độc nhé! ❤️`

// Urgency level descriptions
const URGENCY_DESCRIPTIONS = {
    0: 'Bình thường - Tham vấn thông thường',
    1: 'Cần chú ý - Có dấu hiệu khó khăn',
    2: 'Khẩn cấp - Cần hỗ trợ sớm',
    3: 'Rất khẩn cấp - Cần can thiệp ngay'
}

/**
 * Get the initial welcome message from AI
 */
export function getWelcomeMessage() {
    return AI_WELCOME_MESSAGE
}

/**
 * Get AI questions
 */
export function getAIQuestions() {
    return AI_QUESTIONS
}

/**
 * Get the wait message after questions
 */
export function getWaitMessage() {
    return AI_WAIT_MESSAGE
}

/**
 * Check if AI should respond (counselor hasn't replied yet)
 */
export function shouldAIRespond(chatRoom) {
    // AI stops responding once a counselor has replied
    if (chatRoom.counselor_first_reply_at) {
        return false
    }

    // AI also stops if triage is complete
    if (chatRoom.ai_triage_complete) {
        return false
    }

    return true
}

/**
 * Analyze student messages and classify urgency using Gemini API
 * @param {string[]} studentMessages - Array of student message contents
 * @returns {Promise<{urgencyLevel: number, reasoning: string}>}
 */
export async function analyzeUrgency(studentMessages) {
    const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

    if (!GEMINI_API_KEY) {
        console.warn('Gemini API key not configured, using default urgency')
        return { urgencyLevel: 0, reasoning: 'API not configured' }
    }

    const prompt = `Bạn là chuyên gia tâm lý học đường. Phân tích các tin nhắn sau từ một học sinh và đánh giá mức độ khẩn cấp từ 0-3:

0 = Bình thường (tham vấn thông thường, không có dấu hiệu lo ngại)
1 = Cần chú ý (có một số khó khăn cần theo dõi)
2 = Khẩn cấp (cần hỗ trợ sớm, có dấu hiệu căng thẳng đáng kể)
3 = Rất khẩn cấp (cần can thiệp ngay, có dấu hiệu nguy hiểm hoặc tự làm hại)

Tin nhắn của học sinh:
${studentMessages.map((msg, i) => `${i + 1}. "${msg}"`).join('\n')}

Trả lời theo định dạng JSON:
{
  "urgencyLevel": <số từ 0-3>,
  "reasoning": "<giải thích ngắn gọn lý do>"
}

Chỉ trả về JSON, không thêm text khác.`

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 200
                    }
                })
            }
        )

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`)
        }

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0])
            return {
                urgencyLevel: Math.min(3, Math.max(0, parseInt(result.urgencyLevel) || 0)),
                reasoning: result.reasoning || ''
            }
        }

        return { urgencyLevel: 0, reasoning: 'Could not parse AI response' }
    } catch (error) {
        console.error('AI triage error:', error)
        return { urgencyLevel: 0, reasoning: `Error: ${error.message}` }
    }
}

/**
 * Analyze appointment issues for urgency classification
 */
export async function analyzeAppointmentUrgency(issuesText) {
    return analyzeUrgency([issuesText])
}

export { URGENCY_DESCRIPTIONS }
