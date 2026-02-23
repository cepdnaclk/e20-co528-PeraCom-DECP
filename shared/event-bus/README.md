### How to use the package

1. Add the package to microservice that needs to use the event bus. For example, if you want to use the event bus in the identity-service, add the following line to the `dependencies` section of the `package.json` file of the identity service:

```json
"dependencies": {
  "@decp/event-bus": "file:../../shared/event-bus"
}
```

2. Install the package by running the following command in the terminal:

```bash
npm install
```

3. Now identity-service can import the event bus and use it to publish and subscribe to events. For example, to publish an event, you can do the following:

```typescript
import { EventBus } from "@decp/event-bus";
```
