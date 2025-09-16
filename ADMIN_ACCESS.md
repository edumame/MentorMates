 Admin access is checked by calling an rpc function on the backend. The function returns a boolean:
 
 ```
 const { data } = await supabase.rpc("is_admin_user", { user_id: userId });
 const isAdmin = data || false;
 ```

 