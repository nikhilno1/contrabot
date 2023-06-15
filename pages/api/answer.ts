//https://github.com/hwchase17/langchainjs/blob/5661b2d07c1dd1ea2c2c8296a314d5cadcb52985/docs/docs/getting-started/guide-chat.mdx#memory-add-state-to-chains-and-agents

import { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient, Prisma } from '@prisma/client'
import { ChatOpenAI } from 'langchain/chat_models/openai'
import { ConversationChain } from 'langchain/chains'
import { PromptTemplate } from 'langchain'
import { personalPromptTemplate } from '../../prompt.config'
import { HumanChatMessage, SystemChatMessage } from 'langchain/schema'
import { BufferMemory } from 'langchain/memory'
import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
  MessagesPlaceholder,
} from 'langchain/prompts'

export const config = {
  runtime: 'edge',
}

// eslint-disable-next-line import/no-anonymous-default-export
export default async (req: NextApiRequest, res: NextApiResponse) => {
  const opinion = req.body
  const prisma = new PrismaClient()
  const questionInDB = await prisma.question.create({
    data: {
      content: opinion,
    },
  })

  //console.log('Added question to DB')

  const chat = new ChatOpenAI({
    modelName: 'gpt-3.5-turbo',
    openAIApiKey: process.env.OPENAI_API_KEY,
    temperature: 0.3,
  })

  // const promptTemplateBot = /*#__PURE__*/ new PromptTemplate({
  //   template: personalPromptTemplate,
  //   inputVariables: ['context', 'question'],
  // })

  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    SystemMessagePromptTemplate.fromTemplate(personalPromptTemplate),
    new MessagesPlaceholder('history'),
    HumanMessagePromptTemplate.fromTemplate('{input}'),
  ])

  //const llmChain = new LLMChain({ llm: model, prompt: promptTemplateBot })
  //const stuffChain = new StuffDocumentsChain({ llmChain })

  const chain = new ConversationChain({
    memory: new BufferMemory({ returnMessages: true, memoryKey: 'history' }),
    prompt: chatPrompt,
    llm: chat,
  })
  //console.log('Created chain')

  //console.log('Calling OpenAI API with question: ' + question)
  /* Ask it a question and the answer */
  const result = await chain.call({
    input: opinion,
  })

  // const result = await Promise.race([
  //   chain.call({
  //     query: question,
  //   }),
  //   new Promise((_, reject) =>
  //     setTimeout(() => reject(new Error('Timeout after 10 seconds')), 10000)
  //   ),
  // ])

  //console.log(result.response)

  await prisma.question.update({
    where: {
      id: questionInDB.id,
    },
    data: {
      answer: result.response,
      successFromLLM: true,
    },
  })

  //console.log('Updated question in DB. Returning 200 OK')

  return res.status(200).json(result)
}
