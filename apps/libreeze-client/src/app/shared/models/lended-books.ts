export interface LendedBook {
    user_id: string;
    
    library_id: string;
    library_name: string;
    library_book_id: string;
    
    book_id: string;
    book_title: string;
    authors: string;
    publisher: string;
    
    lending_transaction_id: string;
    status: 'borrowed' | 'returned' | 'overdue';
    borrow_date: Date;
    due_date?: Date;
    returned_date?: Date;
}