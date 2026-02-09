#!/bin/bash

# Camera Network Scanner
# Scans local network for IP cameras

NETWORK="192.168.68"
TIMEOUT=1

echo "========================================="
echo "IP Camera Network Scanner"
echo "Scanning network: ${NETWORK}.0/24"
echo "========================================="
echo ""

# Common camera ports
PORTS=(80 443 554 1935 8000 8080 8554)

# Common camera endpoints
ENDPOINTS=(
    "/stream"
    "/video"
    "/mjpeg"
    "/live"
    "/api/stream"
    "/api/video"
    "/cgi-bin/video.cgi"
    "/videostream.cgi"
    "/axis-cgi/mjpg/video.cgi"
    "/snapshot.cgi"
    "/video.cgi"
    "/onvif/device_service"
)

echo "Step 1: Quick port scan for camera services..."
echo "------------------------------------------------"

for i in {1..254}; do
    IP="${NETWORK}.${i}"

    # Quick check if host is up
    if ping -c 1 -W 1 "$IP" > /dev/null 2>&1; then
        echo -e "\n[✓] Host found: $IP"

        # Check common camera ports
        for PORT in "${PORTS[@]}"; do
            if nc -z -w 1 "$IP" "$PORT" 2>/dev/null; then
                echo "  [✓] Port $PORT is OPEN"

                # Try HTTP endpoints on web ports
                if [ "$PORT" = "80" ] || [ "$PORT" = "8080" ]; then
                    for ENDPOINT in "${ENDPOINTS[@]}"; do
                        STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "http://${IP}:${PORT}${ENDPOINT}" 2>/dev/null)
                        if [ "$STATUS" = "200" ] || [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
                            echo "    [✓] Found endpoint: http://${IP}:${PORT}${ENDPOINT} (HTTP $STATUS)"
                        fi
                    done
                fi

                # Check for RTSP
                if [ "$PORT" = "554" ] || [ "$PORT" = "8554" ]; then
                    echo "    [✓] RTSP server detected at rtsp://${IP}:${PORT}"
                    echo "    Try: rtsp://${IP}:${PORT}/stream"
                    echo "    Try: rtsp://${IP}:${PORT}/live"
                    echo "    Try: rtsp://${IP}:${PORT}/Streaming/Channels/101"
                fi
            fi
        done
    fi
done

echo -e "\n========================================="
echo "Scan complete!"
echo "========================================="
echo ""
echo "Common RTSP stream URLs to try:"
echo "  rtsp://[IP]:554/stream"
echo "  rtsp://[IP]:554/live"
echo "  rtsp://[IP]:554/Streaming/Channels/101"
echo "  rtsp://[IP]:554/user=admin&password=&channel=1&stream=0.sdp"
echo ""
echo "Common HTTP stream URLs to try:"
echo "  http://[IP]/stream"
echo "  http://[IP]/video"
echo "  http://[IP]:8080/video"
echo ""
