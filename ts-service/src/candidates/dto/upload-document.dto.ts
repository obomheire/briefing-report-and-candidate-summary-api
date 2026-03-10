import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const DOCUMENT_TYPES = ['resume', 'cover_letter', 'portfolio', 'other'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export class UploadDocumentDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(DOCUMENT_TYPES, {
    message: `documentType must be one of: ${DOCUMENT_TYPES.join(', ')}`,
  })
  documentType!: DocumentType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  storageKey!: string;

  @IsString()
  @IsNotEmpty()
  rawText!: string;
}
