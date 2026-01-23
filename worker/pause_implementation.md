Flow:
1. user pressed the pause agent button
2. getstream sends a custom event with knowledge about which agent was paused
3. call session pause
    a. session pause saves the cached conversation server side on the worker and then disconnects the realtime agent

4. user pressed the resume agent button
5. getstream sends a custom event with knowledge about which agent was resumed   
6. call session resume
    a. session resume reconnects the agent but passes in realtime into

7. Transcription should still be on during this process, so what the user says will be sent to the model.
