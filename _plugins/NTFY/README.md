
# NTFY Plugin

## What is ntfy?

[ntfy](https://ntfy.sh/) is a lightweight, open-source push notification service that allows you to send messages to mobile devices, desktops, or servers in real-time. It is designed for simplicity and efficiency, making it easy to set up and integrate with your systems to receive notifications as events occur.

## What is the NTFY Plugin?

This plugin integrates with the ntfy service to display real-time alerts directly on your dashboard. It fetches notifications (alerts) and renders them using the TRMNL Design System, ensuring a consistent and clean interface across your application.

![ntfy plugin screenshot](./preview/full.png)

### Key Features

- **Periodic Notifications**: The plugin polls for the latest alerts and displays them as they arrive. Because the TRMNL device is an e-ink display, it will only update periodically conserving battery life. 

**REAL TIME NOTIFICATIONS ARE NOT SUPPORTED ON THE TRMNL DEVICE.**

## How to use the NTFY plugin

There are many integrations for ntfy.sh, and you can use any of them to send messages to the topic.

### Web

You can send messages to the topic using the ntfy.sh [web interface](https://ntfy.sh/trmnl-example12345/publish?title=Hello%20World&message=This%20is%20a%20test%20message) 

### NTFY CLI
You can send messages to the topic using the `ntfy` command line tool.

```bash
ntfy publish --topic trmnl-example12345 --title "Hello World" --message "This is a test message"
```

### Curl
```bash
curl -X POST https://ntfy.sh/trmnl-example12345/publish?title=Hello%20World&message=This%20is%20a%20test%20message
```

### Home Assistant
You can [send messages to the topic from Home Assistant](https://docs.ntfy.sh/examples/#home-assistant) in the configuration.yaml file.


### Others
There are many other integrations for ntfy.sh, and you can use any of them to send messages to the topic.

See the [ntfy.sh examples](https://docs.ntfy.sh/examples/) for more information.




This plugin provides a simple and effective way to monitor and display ntfy alerts, making it easier for you to stay updated with real-time notifications.

Happy notifying!