
import {Link} from 'react-router-dom'

function Icon({to, src, alt}) {
    return (
        <>
         <li>
            <Link to={to}>
                <img src={src} alt={alt} className="h-10 w-10" />
            </Link>
         </li>
        </>
    )
}


export default Icon;