import {Link, Navigate} from "react-router-dom";
import {useContext, useEffect} from "react";
import {UserContext} from "./UserContext";

const serverUrl = "https://15.206.54.3:8000"
// const serverUrl = "http://localhost:8000"

export default function Header() {
  const {setUserInfo,userInfo} = useContext(UserContext);


  useEffect(() => {
    fetch(`${serverUrl}/profile`, {
      credentials: 'include',
    }).then(response => {
      if (response.err)
      {
        return <Navigate to="/login"/>
      }
      response.json().then(userInfo => {
        setUserInfo(userInfo);
      });
    });
  }, []);



  function logout() {
    fetch(`${serverUrl}/logout`, {
      credentials: 'include',
      method: 'POST',
    });
    setUserInfo(null);
  }

  const username = userInfo?.username;

  return (
    <header>
      <Link to="/" className="logo">BlogBay</Link>
      <nav>
        {username && (
          <>
            <Link to="/create">Create new post</Link>
            <a onClick={logout}>Logout ({username})</a>
          </>
        )}
        {!username && (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </nav>
    </header>
  );
}
