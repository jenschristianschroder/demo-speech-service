@description('Azure region')
param location string

@description('Container App name')
param name string

@description('Container Apps Environment resource ID')
param environmentId string

@description('Container image reference')
param containerImage string

@description('User-Assigned Managed Identity resource ID')
param identityId string

@description('Client ID of the managed identity')
param identityClientId string

@description('Azure Speech region')
param speechRegion string

@description('Azure Speech endpoint (custom subdomain URL)')
param speechEndpoint string

@description('ACR login server')
param acrLoginServer string

resource apiApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false
        targetPort: 3001
        transport: 'http'
      }
      registries: [
        {
          server: acrLoginServer
          identity: identityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: name
          image: containerImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'PORT', value: '3001' }
            { name: 'AZURE_SPEECH_REGION', value: speechRegion }
            { name: 'AZURE_SPEECH_ENDPOINT', value: speechEndpoint }
            { name: 'AZURE_CLIENT_ID', value: identityClientId }
            { name: 'CORS_ORIGIN', value: '*' }
          ]
          probes: [
            {
              type: 'Startup'
              httpGet: { path: '/health/startup', port: 3001 }
              initialDelaySeconds: 5
              periodSeconds: 5
            }
            {
              type: 'Liveness'
              httpGet: { path: '/health/live', port: 3001 }
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: { path: '/health/ready', port: 3001 }
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 2
      }
    }
  }
}

@description('API Container App FQDN')
output fqdn string = apiApp.properties.configuration.ingress.fqdn
