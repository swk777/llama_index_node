import { OpenAIApi, Configuration } from 'openai'

export default class Openai {
  private static instance: OpenAIApi
  public static getInstance() {
    if (!Openai.instance) {
      const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
        basePath: process.env.BASE_PATH || 'https://api.openai.com/v1'
      })
      Openai.instance = new OpenAIApi(configuration)
    }
    return Openai.instance
  }
}
