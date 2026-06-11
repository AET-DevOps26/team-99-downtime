{{- define "t99-app.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "t99-app.image" -}}
{{- printf "%s/%s:%s" .registry .repo .tag -}}
{{- end }}
