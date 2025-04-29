import { Inject, Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { DOCUMENT } from '@angular/common';
import { LendedBook } from '../shared/models/lended-books';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private userSubject = new BehaviorSubject<User | null>(null);
  private adminSubject = new BehaviorSubject<boolean>(false);

  constructor(@Inject(DOCUMENT) private document: Document) {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );

    // Check for existing session
    this.supabase.auth.getSession().then(({ data }) => {
      if (data && data.session) {
        this.userSubject.next(data.session.user);
        this.checkAdminStatus(data.session.user.id);
      }
    });

    // Listen for auth changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        this.userSubject.next(session.user);
        this.checkAdminStatus(session.user.id);
      } else {
        this.userSubject.next(null);
        this.adminSubject.next(false);
      }
    });
  }

  // Get current session user
  public async getSessionUser(): Promise<User | null> {    
    if (this.userSubject.value) {
      return this.userSubject.value;
    } else {
      const { data } = await this.supabase.auth.getSession();
      if (data && data.session) {
        this.userSubject.next(data.session.user);
        this.checkAdminStatus(data.session.user.id);
        return data.session.user;
      } else {
        this.userSubject.next(null);
        return null;
      }
    }
  }

  // Check if current user is admin
  public async checkAdminStatus(userId: string): Promise<void> {
    try {
      const { data, error } = await this
                                      .supabase
                                      .from('library_users')
                                      .select()
                                      .match({user_id: userId, is_admin: true});

      if (error) throw error;
      this.adminSubject.next(data.length > 0 || false);
    } catch (error) {
      console.error('Error checking admin status:', error);
      this.adminSubject.next(false);
    }
  }

  // Get current auth user
  public get user(): Observable<User | null> {
    return this.userSubject.asObservable();
  }

  // Get current user admin status
  public get isAdmin(): Observable<boolean> {
    return this.adminSubject.asObservable();
  }

  // Get current auth token
  public async getToken(): Promise<string | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.access_token || null;
  }

  // Auth methods
  public async signUp(email: string, password: string, fullName: string): Promise<any> {
    const redirectUrl = `${this.document.location.origin}/auth/library-options`;
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });

    if (authError) throw authError;

    // If sign-up was successful, create the user record
    if (authData.user) {
      const { error: profileError } = await this.supabase
        .from('users')
        .insert({
          id: authData.user.id,
          full_name: fullName,
          email: email
        });

      if (profileError) throw profileError;
    }

    return authData;
  }

  public async signIn(email: string, password: string): Promise<any> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  public async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
  }

  // Library methods
  public async createLibrary(admin_id: string, name: string, address: string, email: string, phone?: string): Promise<any> {
    const { data: library, error: libraryError } = await this.supabase
      .from('libraries')
      .insert({
        name: name,
        address: address,
        contact_email: email,
        contact_phone: phone
      })
      .select();

    if (libraryError) throw libraryError;

    if(library[0].id) {
      const { error: libUserError } = await this.supabase
        .from('library_users')
        .insert({ 
          library_id: library[0].id,
          user_id: admin_id,
          is_admin: true,
          member_since: new Date()
         });
         
         if (libUserError) throw libUserError;
    }
  }

  public async getUserLibraries(user_id: string): Promise<any[]> {
    const { data, error } = await this.supabase
                                        .from('library_users')
                                        .select('*')
                                        .eq('user_id', user_id)
                                        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  public async getLibraryById(id: string): Promise<any> {
    const { data, error } = await this.supabase
                                        .from('libraries')
                                        .select('*')
                                        .eq('id', id)
                                        .single();

    if (error) throw error;
    return data;
  }

  // Book methods
  public async getBooks(searchTerm: string = ''): Promise<any[]> {
    let query = this.supabase
      .from('books')
      .select('*')
      .order('title');

    if (searchTerm) {
      query = query.or(`title.ilike.%${searchTerm}%,author.ilike.%${searchTerm}%,isbn.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  public async getBookById(id: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('books')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  public async getBookByIsbn(isbn: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('books')
      .select('*')
      .eq('isbn', isbn)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
    return data;
  }

  public async addBook(bookData: any): Promise<any> {
    const token = await this.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${environment.supabaseUrl}/functions/v1/add-book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(bookData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to add book');
    }

    return await response.json();
  }

  // Lending methods
  public async getLendingHistory(userId?: string): Promise<any[]> {
    let query = this.supabase
                      .from('lending_transactions')
                      .select(`
                        *,
                        library_books:library_book_id(id, book_id)
                      `)
                      .order('borrowed_date', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  public async getCurrentBorrowings(userId?: string): Promise<any[]> {
    let query = this.supabase
                      .from('lending_transactions')
                      .select(`
                        *,
                        library_books:library_book_id(id, book_id)
                      `)
                      .in('status', ['borrowed', 'overdue']);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  public async getAllLendingHistory(userId: string): Promise<any[]> {
    const { data, error } = await this.supabase
                                        .from('lending_transactions')
                                        .select(`
                                          *,
                                          library_books(
                                            id, 
                                            book_id, 
                                            library_id,
                                            libraries(
                                              id,
                                              name),
                                            books(
                                              id,
                                              title,
                                              publisher,
                                              authors:book_authors(
                                                author_id,
                                                authors(
                                                  id,
                                                  name
                                                )
                                              )
                                            )
                                          )`
                                        )
                                        .eq('user_id', userId)
                                        .order('borrowed_date', { ascending: false });

    if (error) throw error;

    var lendedBooks: LendedBook[] = [];

    if (!data) return lendedBooks;    
    
    data.forEach(x => {
      var lendedBook: LendedBook = {
        user_id: userId,
        library_id: x.library_books.library_id,
        library_name: x.library_books.libraries.name,
        library_book_id: x.library_books.id,
        book_id: x.library_books.book_id,
        book_title: x.library_books.books.title,
        authors: x.library_books.books.authors.map((author: any) => author.authors.name).join(', '),
        publisher: x.library_books.books.publisher,
        lending_transaction_id: x.id,
        status: x.status,
        borrow_date: new Date(x.borrowed_date),
        due_date: new Date(x.due_date),
        returned_date: new Date(x.returned_date)
      };
      lendedBooks.push(lendedBook);
    });

    return lendedBooks || [];
  }

  public async lendBook(bookId: string, memberId: string, dueDate: string): Promise<any> {
    const token = await this.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${environment.supabaseUrl}/functions/v1/lend-book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ book_id: bookId, member_id: memberId, due_date: dueDate })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to lend book');
    }

    return await response.json();
  }

  public async returnBook(transactionId: string): Promise<any> {
    const token = await this.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${environment.supabaseUrl}/functions/v1/return-book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ transaction_id: transactionId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to return book');
    }

    return await response.json();
  }

  // User methods
  public async getUsers(searchTerm: string = ''): Promise<any[]> {
    let query = this.supabase
      .from('users')
      .select('*')
      .order('full_name');

    if (searchTerm) {
      query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  public async getUserById(id: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  public async updateUserProfile(id: string, profileData: any): Promise<any> {
    const { data, error } = await this.supabase
                                        .from('users')
                                        .update(profileData)
                                        .eq('id', id)
                                        .select()
                                        .single();

    if (error) throw error;
    return data;
  }

  public getUserProfilePhotoUrl(userId: string): string | null {
    const { data } = this.supabase
                            .storage
                            .from('libreeze')
                            .getPublicUrl(`${userId}/profile-photo.jpg`);

    return data.publicUrl;
  }

  // Storage methods
  public async uploadBookCover(file: File, isbn: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const filePath = `book-covers/${isbn}.${fileExt}`;
    
    const { error } = await this.supabase.storage
      .from('libreeze')
      .upload(filePath, file, { upsert: true });
    
    if (error) throw error;
    
    const { data } = this.supabase.storage
      .from('libreeze')
      .getPublicUrl(filePath);
      
    return data.publicUrl;
  }

  public async uploadProfilePhoto(file: File, userId: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/profile-photo.${fileExt}`;
    
    const { error } = await this.supabase
                                    .storage
                                    .from('libreeze')
                                    .upload(filePath, file, { upsert: true });
    
    if (error) throw error;
    
    const { data } = this.supabase
                            .storage
                            .from('libreeze')
                            .getPublicUrl(filePath);
      
    return data.publicUrl;
  }
}