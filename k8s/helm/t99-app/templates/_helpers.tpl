{{- define "t99-app.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "t99-app.selectorLabels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "t99-app.image" -}}
{{- printf "%s/%s:%s" .registry .repo .tag -}}
{{- end }}

{{/* Prometheus scrape config. Shared by the ConfigMap and the pod checksum, so
     an edit here rolls the pod. */}}
{{- define "t99-app.prometheusConfig" -}}
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: {{ .Release.Namespace }}

rule_files:
  - /etc/prometheus/rules/*.yaml

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['{{ .Release.Name }}-alertmanager:9093']

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ['localhost:9090']

  - job_name: kubernetes-pods
    kubernetes_sd_configs:
      - role: pod
        # Own namespace only: a cluster-wide pod list would be denied.
        namespaces:
          names: [{{ .Release.Namespace }}]
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: "true"
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__
      - source_labels: [__meta_kubernetes_pod_phase]
        action: drop
        regex: (Pending|Succeeded|Failed)
      - action: labelmap
        regex: __meta_kubernetes_pod_label_(.+)
      - source_labels: [__meta_kubernetes_namespace]
        action: replace
        target_label: namespace
      - source_labels: [__meta_kubernetes_pod_name]
        action: replace
        target_label: pod
      - source_labels: [__meta_kubernetes_pod_label_app_kubernetes_io_component]
        action: replace
        target_label: service
{{- end }}
