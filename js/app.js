class VoiceConversation {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.apiBaseUrl = 'http://localhost:5001';

        this.statusEl = document.getElementById('status');
        this.startRecordBtn = document.getElementById('startRecord');
        this.stopRecordBtn = document.getElementById('stopRecord');
        this.resetBtn = document.getElementById('resetConversation');
        this.conversationEl = document.getElementById('conversation');
        this.audioPlayback = document.getElementById('audioPlayback');

        this.initializeEventListeners();
        this.checkMicrophonePermission();
    }

    initializeEventListeners() {
        this.startRecordBtn.addEventListener('click', () => this.startRecording());
        this.stopRecordBtn.addEventListener('click', () => this.stopRecording());
        this.resetBtn.addEventListener('click', () => this.resetConversation());
    }

    async checkMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            this.updateStatus('Ready to start conversation');
        } catch (error) {
            this.updateStatus('Microphone permission required', 'error');
            console.error('Microphone access denied:', error);
        }
    }

    updateStatus(message, type = 'default') {
        this.statusEl.textContent = message;
        this.statusEl.className = 'status';

        if (type === 'recording') {
            this.statusEl.classList.add('recording');
        } else if (type === 'processing') {
            this.statusEl.classList.add('processing');
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });

            // Check supported MIME types
            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
                'audio/wav'
            ];

            let selectedMimeType = '';
            for (const mimeType of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    selectedMimeType = mimeType;
                    break;
                }
            }

            console.log('Using MIME type:', selectedMimeType);

            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: selectedMimeType
            });

            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                console.log('🎵 Data available:', event.data.size, 'bytes');
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    console.log('📊 Total chunks:', this.audioChunks.length);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('Recording stopped, processing...');
                this.processRecording();
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event);
                this.updateStatus('Recording error occurred');
            };

            this.mediaRecorder.start(1000); // Collect data every second
            this.isRecording = true;

            this.startRecordBtn.disabled = true;
            this.stopRecordBtn.disabled = false;
            this.updateStatus('🎤 Recording... Speak now!', 'recording');

        } catch (error) {
            console.error('Error starting recording:', error);
            this.updateStatus('Error accessing microphone', 'error');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;

            this.startRecordBtn.disabled = false;
            this.stopRecordBtn.disabled = true;
            this.updateStatus('Processing your message...', 'processing');
        }
    }

    async processRecording() {
        try {
            console.log('🎤 Processing recording with', this.audioChunks.length, 'chunks');

            if (this.audioChunks.length === 0) {
                console.log('❌ No audio chunks recorded');
                this.updateStatus('No audio data recorded. Try again.');
                return;
            }

            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            console.log('📦 Created audio blob:', audioBlob.size, 'bytes');

            if (audioBlob.size < 1000) {
                console.log('❌ Audio blob too small:', audioBlob.size, 'bytes');
                this.updateStatus('Recording too short. Please speak longer.');
                return;
            }

            console.log('🔄 Sending audio to speech-to-text...');
            const transcribedText = await this.speechToText(audioBlob);
            console.log('📝 Transcribed text:', transcribedText);

            if (transcribedText && transcribedText.trim()) {
                this.addMessage('user', transcribedText);

                console.log('🤖 Getting AI response...');
                const aiResponse = await this.getAIResponse(transcribedText);
                this.addMessage('ai', aiResponse);

                console.log('🔊 Converting to speech...');
                await this.textToSpeech(aiResponse);
            } else {
                console.log('❌ No speech detected in transcription');
                this.updateStatus('No speech detected. Try speaking louder or longer.');
            }

        } catch (error) {
            console.error('❌ Error processing recording:', error);
            this.updateStatus('Error processing your message: ' + error.message);
        }
    }

    async speechToText(audioBlob) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        const response = await fetch(`${this.apiBaseUrl}/speech-to-text`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Speech-to-text failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.text;
    }

    async getAIResponse(text) {
        const response = await fetch(`${this.apiBaseUrl}/conversation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            throw new Error(`AI response failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.response;
    }

    async textToSpeech(text) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/text-to-speech`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text })
            });

            if (!response.ok) {
                throw new Error(`Text-to-speech failed: ${response.statusText}`);
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            this.audioPlayback.src = audioUrl;
            this.audioPlayback.style.display = 'block';
            this.audioPlayback.play();

            this.updateStatus('Ready to start conversation');

            this.audioPlayback.onended = () => {
                URL.revokeObjectURL(audioUrl);
            };

        } catch (error) {
            console.error('Error with text-to-speech:', error);
            this.updateStatus('Voice response failed, but text is shown above');
        }
    }

    addMessage(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;

        const labelDiv = document.createElement('div');
        labelDiv.className = 'message-label';
        labelDiv.textContent = sender === 'user' ? 'You:' : 'AI:';

        const contentDiv = document.createElement('div');
        contentDiv.textContent = text;

        messageDiv.appendChild(labelDiv);
        messageDiv.appendChild(contentDiv);

        this.conversationEl.appendChild(messageDiv);
        this.conversationEl.scrollTop = this.conversationEl.scrollHeight;
    }

    async resetConversation() {
        try {
            await fetch(`${this.apiBaseUrl}/reset-conversation`, {
                method: 'POST'
            });

            this.conversationEl.innerHTML = '';
            this.audioPlayback.style.display = 'none';
            this.updateStatus('Conversation reset. Ready to start fresh!');

        } catch (error) {
            console.error('Error resetting conversation:', error);
            this.conversationEl.innerHTML = '';
            this.updateStatus('Conversation reset locally');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new VoiceConversation();
});