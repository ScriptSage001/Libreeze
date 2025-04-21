import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private userSubject = new BehaviorSubject<User | null>(null);
  private adminSubject = new BehaviorSubject<boolean>(false);

  constructor() {
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

  // Check if current user is admin
  public async checkAdminStatus(userId: string): Promise<void> {
    try {
      const { data, error } = await this
                                      .supabase
                                      .from('members')
                                      .select('is_admin')
                                      .eq('id', userId)
                                      .single();

      if (error) throw error;
      this.adminSubject.next(data.is_admin || false);
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
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;

    // If sign-up was successful, create the member record
    if (authData.user) {
      const { error: profileError } = await this.supabase
        .from('members')
        .insert({
          id: authData.user.id,
          full_name: fullName,
          email: email,
          is_admin: false // Default to non-admin
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
  public async getLendingHistory(memberId?: string): Promise<any[]> {
    let query = this.supabase
      .from('lending_transactions')
      .select(`
        *,
        books:book_id(id, title, author, isbn),
        members:member_id(id, full_name, email)
      `)
      .order('borrowed_date', { ascending: false });

    if (memberId) {
      query = query.eq('member_id', memberId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  public async getCurrentBorrowings(memberId?: string): Promise<any[]> {
    let query = this.supabase
      .from('lending_transactions')
      .select(`
        *,
        books:book_id(id, title, author, isbn),
        members:member_id(id, full_name, email)
      `)
      .in('status', ['borrowed', 'overdue']);

    if (memberId) {
      query = query.eq('member_id', memberId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
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

  // Member methods
  public async getMembers(searchTerm: string = ''): Promise<any[]> {
    let query = this.supabase
      .from('members')
      .select('*')
      .order('full_name');

    if (searchTerm) {
      query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  public async getMemberById(id: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  public async updateMemberProfile(id: string, profileData: any): Promise<any> {
    const { data, error } = await this.supabase
      .from('members')
      .update(profileData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
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
    const filePath = `profile-photos/${userId}.${fileExt}`;
    
    const { error } = await this.supabase.storage
      .from('libreeze')
      .upload(filePath, file, { upsert: true });
    
    if (error) throw error;
    
    const { data } = this.supabase.storage
      .from('libreeze')
      .getPublicUrl(filePath);
      
    return data.publicUrl;
  }
}