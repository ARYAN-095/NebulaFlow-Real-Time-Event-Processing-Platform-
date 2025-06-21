# NebulaFlow: Real-Time Event Processing Platform  
 
*A scalable platform for ingesting, processing, and visualizing IoT sensor data in real time.*

---

## 🚀 Introduction
IoT Pulse is a cloud-native platform that ingests simulated IoT sensor data (temperature, humidity), processes it in real time, computes live metrics, triggers alerts, and powers a dynamic dashboard. Ideal for smart-building demos, it showcases end-to-end event-driven architecture with enterprise-grade scalability.

---

## 🌐 High-Level Architecture  
```mermaid
graph LR
    A[Edge Simulator] -->|MQTT| B(EMQX Broker)
    B -->|Kafka Connector| C[Apache Kafka]
    C --> D[Stream Processor]
    D --> E[Aggregation Microservice]
    E --> F[TimescaleDB]
    F --> G[API Service]
    G --> H[Dashboard]
    D --> I[Alerting Service]
    I --> J[Prometheus]
    J --> K[Slack/Email]
```


```mermaid
    flowchart LR
  subgraph Edge
    SIM[Node.js Simulator]
  end
  subgraph Cloud
    EMQX[EMQX Broker]
    Kafka[Kafka Cluster]
    ksql[ksqlDB Engine]
    AGG[Aggregation Service]
    TSDB[TimescaleDB]
    API[Express + Socket.IO]
    Graf[Grafana / Alertmanager]
  end
  SIM -->|MQTT| EMQX --> SUB[MQTT→Kafka Bridge] --> Kafka
  Kafka --> ksql --> TSDB
  Kafka --> AGG --> TSDB
  TSDB --> API --> Dashboard[Next.js App]
  Kafka --> API
  TSDB --> Graf
  AGG --> Graf
```