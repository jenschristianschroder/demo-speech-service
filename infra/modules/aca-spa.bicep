@description('Azure region')
param location string

@description('Container App name')
param name string

@description('Container Apps Environment resource ID')
param environmentId string

@description('Container image reference')
param containerImage string

@description('Internal URL of the API backend')
param apiBackendUrl string

@description('ACR login server')
param acrLoginServer string

@description('User-Assigned Managed Identity resource ID')
param identityId string

resource spaApp 'Microsoft.App/containerApps@2024-03-01' = {
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
        external: true
        targetPort: 80
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
            { name: 'API_BACKEND_URL', value: apiBackendUrl }
          ]
          probes: [
            {
              type: 'Startup'
              httpGet: { path: '/', port: 80 }
              initialDelaySeconds: 3
              periodSeconds: 5
            }
            {
              type: 'Liveness'
              httpGet: { path: '/', port: 80 }
              periodSeconds: 30
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

@description('SPA Container App FQDN')
output fqdn string = spaApp.properties.configuration.ingress.fqdn
