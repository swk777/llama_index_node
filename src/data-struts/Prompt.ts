export enum PromptType {
  SUMMARY = 'summary',
  TREE_INSERT = 'insert',
  TREE_SELECT = 'tree_select',
  TREE_SELECT_MULTIPLE = 'tree_select_multiple',
  QUESTION_ANSWER = 'text_qa',
  REFINE = 'refine',
  KEYWORD_EXTRACT = 'keyword_extract',
  QUERY_KEYWORD_EXTRACT = 'query_keyword_extract',
  SCHEMA_EXTRACT = 'schema_extract',
  TEXT_TO_SQL = 'text_to_sql',
  TABLE_CONTEXT = 'table_context',
  KNOWLEDGE_TRIPLET_EXTRACT = 'knowledge_triplet_extract',
  SIMPLE_INPUT = 'simple_input',
  PANDAS = 'pandas',
  CUSTOM = 'custom'
}
