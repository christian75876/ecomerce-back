export interface PaginationMetaDto {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

export interface PaginatedResultDto<T> {
  items: T[];
  pagination: PaginationMetaDto;
}
