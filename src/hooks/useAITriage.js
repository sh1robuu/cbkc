/**
 * useAITriage Hook
 * Manages AI initial triage conversation in chat rooms
 */
import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
    getWelcomeMessage,
    getAIQuestions,
    getWaitMessage,
    shouldAIRespond,
    analyzeUrgency
} from '../lib/aiTriage'

const AI_SENDER_ID = 'ai-assistant' // Special ID for AI messages

export function useAITriage(chatRoomId, chatRoom) {
    const [isProcessing, setIsProcessing] = useState(false)
    const questionIndexRef = useRef(0)

    /**
     * Send AI message to chat
     */
    const sendAIMessage = useCallback(async (content) => {
        try {
            await supabase
                .from('chat_messages')
                .insert({
                    chat_room_id: chatRoomId,
                    sender_id: null, // NULL indicates system/AI message
                    content: content,
                    is_system: true,
                    metadata: { type: 'ai_triage' }
                })
        } catch (error) {
            console.error('Error sending AI message:', error)
        }
    }, [chatRoomId])

    /**
     * Initialize AI triage when chat room is created
     */
    const initializeTriage = useCallback(async () => {
        if (!chatRoom || chatRoom.ai_triage_complete || chatRoom.counselor_first_reply_at) {
            return
        }

        setIsProcessing(true)

        // Send welcome message
        await sendAIMessage(getWelcomeMessage())

        // Wait a bit then send first question
        setTimeout(async () => {
            const questions = getAIQuestions()
            if (questions.length > 0) {
                await sendAIMessage(questions[0])
                questionIndexRef.current = 1
            }
            setIsProcessing(false)
        }, 1500)
    }, [chatRoom, sendAIMessage])

    /**
     * Process student message and respond accordingly
     */
    const processStudentMessage = useCallback(async (messageContent, allStudentMessages) => {
        if (!chatRoom || !shouldAIRespond(chatRoom)) {
            return
        }

        setIsProcessing(true)
        const questions = getAIQuestions()

        // Check if we need to ask more questions
        if (questionIndexRef.current < questions.length) {
            // Wait a bit then ask next question
            setTimeout(async () => {
                await sendAIMessage(questions[questionIndexRef.current])
                questionIndexRef.current++
                setIsProcessing(false)
            }, 1000)
        } else {
            // All questions answered, analyze and complete triage
            try {
                const { urgencyLevel, reasoning } = await analyzeUrgency(allStudentMessages)

                // Update chat room with urgency level
                await supabase
                    .from('chat_rooms')
                    .update({
                        urgency_level: urgencyLevel,
                        ai_triage_complete: true
                    })
                    .eq('id', chatRoomId)

                // Send closing message
                await sendAIMessage(getWaitMessage())

                // If high urgency, send additional message
                if (urgencyLevel >= 2) {
                    setTimeout(async () => {
                        await sendAIMessage(
                            `⚠️ Dựa trên những gì bạn chia sẻ, mình đã đánh dấu cuộc trò chuyện này là ${urgencyLevel === 3 ? 'rất khẩn cấp' : 'khẩn cấp'
                            } để tư vấn viên ưu tiên hỗ trợ bạn.`
                        )
                    }, 1500)
                }

                console.log('AI Triage complete:', { urgencyLevel, reasoning })
            } catch (error) {
                console.error('Error completing triage:', error)
            }

            setIsProcessing(false)
        }
    }, [chatRoom, chatRoomId, sendAIMessage])

    /**
     * Check if a message is from AI
     */
    const isAIMessage = (message) => {
        return message.is_system && message.metadata?.type === 'ai_triage'
    }

    return {
        initializeTriage,
        processStudentMessage,
        isProcessing,
        isAIMessage,
        shouldAIRespond: shouldAIRespond(chatRoom || {})
    }
}
